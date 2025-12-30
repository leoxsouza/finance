import type { Prisma, PrismaClient } from "@prisma/client";

import prisma from "@/lib/db";
import type { CardImportSession, CardPurchaseOverrideMap } from "@/lib/types/card-import";

type LineageState = "NEW" | "MATCHED" | "UPDATED" | "REVERSED";

type PersistenceClient = PrismaClient;
const CARD_IMPORT_TRANSACTION_TIMEOUT_MS = resolveTransactionTimeout();
const PURCHASE_BATCH_SIZE = 20;
const INSTALLMENT_BATCH_SIZE = 20;
const EVENT_BATCH_SIZE = 50;
const LEDGER_BATCH_SIZE = 20;
const AUVP_ENVELOPE_FALLBACKS: Record<string, string> = {
  "custos fixos": "Custos fixos",
  conforto: "Conforto",
  prazeres: "Prazeres",
  metas: "Metas",
  "liberdade financeira": "Liberdade Financeira",
  conhecimento: "Conhecimento",
};
type CardImportTransactionClient = {
  cardStatementImport: PersistenceClient["cardStatementImport"];
  cardPurchase: PersistenceClient["cardPurchase"];
  cardInstallment: PersistenceClient["cardInstallment"];
  cardImportEvent: PersistenceClient["cardImportEvent"];
  transaction: PersistenceClient["transaction"];
  envelope: PersistenceClient["envelope"];
};
type EnvelopeLookup = Map<string, number>;

export type SaveImportSessionParams = {
  session: CardImportSession;
  userId: string;
  overrides?: CardPurchaseOverrideMap;
  force?: boolean;
};

export type SaveImportSessionResult = {
  statementImportId: number;
  createdPurchases: number;
  createdInstallments: number;
  skippedInstallments: number;
  ignoredInstallments: Array<{
    cardPurchaseKey: string;
    installmentNumber: number;
    installmentCount?: number;
    reason: 'DUPLICATE_IN_SESSION';
    rawLine?: string;
  }>;
};

export class CardImportPersistenceError extends Error {
  constructor(
    message: string,
    public readonly code: "MISSING_FILE_HASH" | "DUPLICATE_IMPORT" | "INVALID_PAYLOAD",
  ) {
    super(message);
    this.name = "CardImportPersistenceError";
  }
}

async function syncLedgerTransactions(
  tx: CardImportTransactionClient,
  purchaseRecords: Map<string, PersistedPurchaseRecord>,
  envelopeLookup: EnvelopeLookup,
) {
  if (!purchaseRecords.size) {
    return;
  }

  const purchaseIds = Array.from(purchaseRecords.values()).map((record) => record.id);
  if (!purchaseIds.length) {
    return;
  }

  const existingTransactions = await tx.transaction.findMany({
    where: {
      cardPurchaseId: {
        in: purchaseIds,
      },
    },
  });

  const existingByPurchaseId = new Map<number, (typeof existingTransactions)[number]>();
  existingTransactions.forEach((transaction) => {
    if (transaction.cardPurchaseId) {
      existingByPurchaseId.set(transaction.cardPurchaseId, transaction);
    }
  });

  type LedgerUpdateTask = {
    id: number;
    data: Prisma.TransactionUncheckedUpdateInput;
  };
  const createBuffer: Prisma.TransactionCreateManyInput[] = [];
  const updateTasks: LedgerUpdateTask[] = [];

  const flushLedgerCreates = async () => {
    if (!createBuffer.length) {
      return;
    }
    const batches = chunk(createBuffer.splice(0, createBuffer.length), LEDGER_BATCH_SIZE);
    for (const batch of batches) {
      await tx.transaction.createMany({
        data: batch,
      });
    }
  };

  const flushLedgerUpdates = async () => {
    if (!updateTasks.length) {
      return;
    }
    const batch = updateTasks.splice(0, updateTasks.length);
    const chunks = chunk(batch, LEDGER_BATCH_SIZE);
    for (const part of chunks) {
      await Promise.all(
        part.map((task) =>
          tx.transaction.update({
            where: { id: task.id },
            data: task.data,
          }),
        ),
      );
    }
  };

  for (const record of purchaseRecords.values()) {
    const value = Number(record.totalAmount);
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    const type = record.isReversal ? "IN" : "OUT";
    const envelopeId = type === "OUT" ? resolveEnvelopeIdFromCategory(record.resolvedCategory, envelopeLookup) : null;
    const existing = existingByPurchaseId.get(record.id);

    if (!existing) {
      createBuffer.push({
        date: record.purchaseDate,
        description: record.description,
        value,
        type,
        cardPurchaseId: record.id,
        envelopeId: type === "OUT" ? envelopeId ?? null : null,
      });
      if (createBuffer.length >= LEDGER_BATCH_SIZE) {
        await flushLedgerCreates();
      }
      continue;
    }

    updateTasks.push({
      id: existing.id,
      data: {
        date: record.purchaseDate,
        description: record.description,
        value,
        type,
        envelopeId: type === "OUT" ? envelopeId ?? null : null,
      },
    });
    if (updateTasks.length >= LEDGER_BATCH_SIZE) {
      await flushLedgerUpdates();
    }
  }

  await flushLedgerCreates();
  await flushLedgerUpdates();
}

type PreparedPurchase = {
  cardPurchaseKey: string;
  description: string;
  normalizedDescription: string;
  resolvedPurchaseDate: Date;
  resolvedTotalAmount: number;
  resolvedCategory?: string;
  statementMonth?: string;
  cardIdentifier?: string;
  metadata?: Prisma.JsonValue;
  rawPayload?: Prisma.JsonValue;
  isReversal?: boolean;
  overrideApplied: boolean;
  resolvedInstallmentCount?: number | null;
};

type PersistedPurchaseRecord = {
  id: number;
  statementImportId: number | null;
  wasCreated: boolean;
  overrideApplied: boolean;
  isReversal: boolean;
  totalAmount: number;
  purchaseDate: Date;
  statementMonth?: string;
  resolvedInstallmentCount?: number | null;
  description: string;
  resolvedCategory?: string | null;
};

export async function saveImportSession(
  params: SaveImportSessionParams,
  client: PersistenceClient = prisma,
): Promise<SaveImportSessionResult> {
  const { session, overrides = {}, userId, force = false } = params;

  if (!session.meta?.fileHash) {
    throw new CardImportPersistenceError("Card import session is missing file hash", "MISSING_FILE_HASH");
  }

  const preparedPurchases = preparePurchases(session, overrides);
  const fallbackStatementMonth = session.meta.statementMonth;

  return client.$transaction(
    async (tx) => {
      const models = tx as unknown as CardImportTransactionClient;
      const statementImport = await upsertStatementImport(models, session, force);
      const eventBuffer: Prisma.CardImportEventCreateManyInput[] = [];

      if (force) {
        const purchaseKeys = preparedPurchases.map((purchase) => purchase.cardPurchaseKey);
        await resetStatementImport(models, statementImport.id, purchaseKeys);
      }

      const { purchaseRecords } = await persistPurchases(models, {
        purchases: preparedPurchases,
        statementImportId: statementImport.id,
        session,
        userId,
        eventBuffer,
      });

      const { createdInstallments, skippedInstallments, ignoredInstallments } = await persistInstallments(models, {
        session,
        statementImportId: statementImport.id,
        fallbackStatementMonth,
        purchaseRecords,
        userId,
        eventBuffer,
      });

      const envelopeLookup = await loadEnvelopeLookup(models);
      await syncLedgerTransactions(models, purchaseRecords, envelopeLookup);
      await flushEvents(models, eventBuffer);

      const createdPurchases = purchaseRecords.size;

      return {
        statementImportId: statementImport.id,
        createdPurchases,
        createdInstallments,
        skippedInstallments,
        ignoredInstallments,
      };
    },
    { timeout: CARD_IMPORT_TRANSACTION_TIMEOUT_MS },
  );
}

function preparePurchases(session: CardImportSession, overrides: CardPurchaseOverrideMap): PreparedPurchase[] {
  return session.purchases.map((purchase) => {
    const override = overrides[purchase.cardPurchaseKey];
    const resolvedPurchaseDate = override?.purchaseDate ?? purchase.purchaseDate;
    if (!resolvedPurchaseDate) {
      throw new CardImportPersistenceError(
        `Purchase ${purchase.cardPurchaseKey} is missing purchaseDate`,
        "INVALID_PAYLOAD",
      );
    }

    const resolvedInstallmentCount = override?.installmentCount ?? purchase.metadata?.installmentCount ?? null;
    const overrideApplied = Boolean(
      override && Object.values(override).some((value) => value !== undefined && value !== null && value !== ""),
    );

    return {
      cardPurchaseKey: purchase.cardPurchaseKey,
      description: purchase.description,
      normalizedDescription: purchase.normalizedDescription,
      resolvedPurchaseDate: toDate(resolvedPurchaseDate),
      resolvedTotalAmount: override?.totalAmount ?? purchase.totalAmount,
      resolvedCategory: override?.auvpCategory ?? purchase.auvpCategory,
      statementMonth: purchase.statementMonth,
      cardIdentifier: purchase.cardIdentifier,
      metadata: purchase.metadata as Prisma.JsonValue,
      rawPayload: purchase.rawPayload as Prisma.JsonValue,
      isReversal: purchase.isReversal,
      overrideApplied,
      resolvedInstallmentCount,
    };
  });
}

async function upsertStatementImport(tx: CardImportTransactionClient, session: CardImportSession, force: boolean) {
  const statementMonthDate = parseStatementMonth(session.meta.statementMonth);
  const existing = await tx.cardStatementImport.findUnique({ where: { fileHash: session.meta.fileHash! } });

  if (existing && !force) {
    throw new CardImportPersistenceError("Statement import already exists for this file", "DUPLICATE_IMPORT");
  }

  const baseData = {
    fileHash: session.meta.fileHash!,
    fileName: session.meta.fileName ?? "card-import.pdf",
    fileSize: session.meta.fileSize ?? session.meta.pdfBytes ?? 0,
    statementMonth: statementMonthDate,
    cardIdentifier: session.meta.cardIdentifier,
    status: "PENDING",
  };

  if (existing) {
    return tx.cardStatementImport.update({ where: { id: existing.id }, data: baseData });
  }

  return tx.cardStatementImport.create({ data: baseData });
}

async function resetStatementImport(tx: CardImportTransactionClient, statementImportId: number, purchaseKeys: string[]) {
  const purchaseFilters: Prisma.CardPurchaseWhereInput[] = [{ statementImportId }];
  if (purchaseKeys.length) {
    purchaseFilters.push({ cardPurchaseKey: { in: purchaseKeys } });
  }

  const purchaseWhere =
    purchaseFilters.length === 1 ? purchaseFilters[0] : { OR: purchaseFilters };

  const existingPurchases = await tx.cardPurchase.findMany({
    where: purchaseWhere,
    select: { id: true },
  });
  const purchaseIds = existingPurchases.map((purchase) => purchase.id);

  await tx.cardImportEvent.deleteMany({ where: { statementImportId } });

  const installmentFilters: Prisma.CardInstallmentWhereInput[] = [{ statementImportId }, { sourceStatementId: statementImportId }];
  if (purchaseIds.length) {
    installmentFilters.push({ cardPurchaseId: { in: purchaseIds } });
  }

  await tx.cardInstallment.deleteMany({
    where: {
      OR: installmentFilters,
    },
  });

  if (purchaseIds.length) {
    await tx.transaction.deleteMany({
      where: { cardPurchaseId: { in: purchaseIds } },
    });

    await tx.cardPurchase.deleteMany({
      where: { id: { in: purchaseIds } },
    });
  }
}

type PersistPurchasesOptions = {
  purchases: PreparedPurchase[];
  statementImportId: number;
  session: CardImportSession;
  userId: string;
  eventBuffer: Prisma.CardImportEventCreateManyInput[];
};

async function persistPurchases(
  tx: CardImportTransactionClient,
  options: PersistPurchasesOptions,
): Promise<{
  purchaseRecords: Map<string, PersistedPurchaseRecord>;
}> {
  const { purchases, statementImportId, session, userId, eventBuffer } = options;
  const purchaseRecords = new Map<string, PersistedPurchaseRecord>();
  const creationQueue: PreparedPurchase[] = [];

  const flushCreationQueue = async () => {
    if (!creationQueue.length) {
      return;
    }
    const batch = creationQueue.splice(0, creationQueue.length);
    const createInputs = batch.map((purchase) => buildPurchaseCreateInput(purchase, session, statementImportId));

    await tx.cardPurchase.createMany({ data: createInputs });

    // Since cardPurchaseKey is no longer unique, we need to fetch by statementImportId
    // to get the records we just created in this batch
    const persisted = await tx.cardPurchase.findMany({
      where: { statementImportId },
      orderBy: { id: "asc" },
    });

    // Match persisted records to batch by index (createMany preserves order)
    // We need to find the newly created records - they are the last N records for this import
    const newRecords = persisted.slice(-batch.length);

    batch.forEach((purchase, index) => {
      const created = newRecords[index];
      if (!created) {
        throw new Error(`Failed to load created purchase ${purchase.cardPurchaseKey}`);
      }
      purchaseRecords.set(
        purchase.cardPurchaseKey,
        toPersistedPurchaseRecord(
          purchase,
          { id: created.id, statementImportId: created.statementImportId ?? null },
          true,
          created.auvpCategory ?? null,
        ),
      );

      enqueueEvent(eventBuffer, {
        statementImportId,
        cardPurchaseId: created.id,
        userId,
        eventType: purchase.overrideApplied ? "ADJUSTED_MANUALLY" : "CREATED_PURCHASE",
        payload: { cardPurchaseKey: purchase.cardPurchaseKey },
      });
    });
  };

  for (const purchase of purchases) {
    creationQueue.push(purchase);
    if (creationQueue.length >= PURCHASE_BATCH_SIZE) {
      await flushCreationQueue();
    }
  }

  await flushCreationQueue();

  return { purchaseRecords };
}

type PersistInstallmentsOptions = {
  session: CardImportSession;
  statementImportId: number;
  fallbackStatementMonth?: string;
  purchaseRecords: Map<string, PersistedPurchaseRecord>;
  userId: string;
  eventBuffer: Prisma.CardImportEventCreateManyInput[];
};

async function persistInstallments(tx: CardImportTransactionClient, options: PersistInstallmentsOptions) {
  const { session, statementImportId, fallbackStatementMonth, purchaseRecords, userId, eventBuffer } = options;
  let createdInstallments = 0;
  let skippedInstallments = 0;
  const ignoredInstallments: Array<{
    cardPurchaseKey: string;
    installmentNumber: number;
    installmentCount?: number;
    reason: 'DUPLICATE_IN_SESSION';
    rawLine?: string;
  }> = [];
  type InstallmentTask = {
    purchaseRecord: PersistedPurchaseRecord;
    installment: CardImportSession["installments"][number];
    data: Prisma.CardInstallmentCreateManyInput;
  };
  const creationQueue: InstallmentTask[] = [];

  const flushInstallmentQueue = async () => {
    if (!creationQueue.length) {
      return;
    }
    const batch = creationQueue.splice(0, creationQueue.length);

    await tx.cardInstallment.createMany({
      data: batch.map((task) => task.data),
    });

    // Fetch the newly created installments for this import
    const persisted = await tx.cardInstallment.findMany({
      where: { statementImportId },
      orderBy: { id: "asc" },
    });

    // Match persisted records to batch - the last N records are the ones we just created
    const newRecords = persisted.slice(-batch.length);

    batch.forEach((task, index) => {
      const created = newRecords[index];
      if (!created) {
        throw new Error(`Failed to load created installment for ${task.installment.cardPurchaseKey}`);
      }
      createdInstallments += 1;

      enqueueEvent(eventBuffer, {
        statementImportId,
        cardPurchaseId: task.purchaseRecord.id,
        cardInstallmentId: created.id,
        userId,
        eventType: "LINKED_INSTALLMENT",
        payload: {
          cardPurchaseKey: task.installment.cardPurchaseKey,
          installmentNumber: task.installment.installmentNumber,
          installmentCount: task.installment.installmentCount,
        },
      });
    });
  };

  for (const installment of session.installments) {

    const purchaseRecord = purchaseRecords.get(installment.cardPurchaseKey);
    if (!purchaseRecord) {
      // Installment references a purchase key not in this session - skip it
      skippedInstallments += 1;
      ignoredInstallments.push({
        cardPurchaseKey: installment.cardPurchaseKey,
        installmentNumber: installment.installmentNumber,
        installmentCount: installment.installmentCount,
        reason: 'DUPLICATE_IN_SESSION',
        rawLine: installment.rawLine,
      });
      continue;
    }

    const statementMonthDate =
      parseStatementMonth(installment.statementMonth ?? purchaseRecord.statementMonth ?? fallbackStatementMonth);
    const dueDate = installment.dueDate ? toDate(installment.dueDate) : null;
    const lineageState = resolveLineageState(purchaseRecord);

    const rawPayload = installment.rawPayload as Prisma.InputJsonValue | undefined;
    const data: Prisma.CardInstallmentCreateManyInput = {
      cardPurchaseId: purchaseRecord.id,
      statementImportId,
      sourceStatementId: purchaseRecord.statementImportId ?? null,
      installmentNumber: installment.installmentNumber,
      installmentCount: installment.installmentCount ?? purchaseRecord.resolvedInstallmentCount ?? null,
      installmentAmount: installment.installmentAmount,
      totalAmount: purchaseRecord.totalAmount,
      statementMonth: statementMonthDate,
      dueDate,
      status: "PENDING",
      lineageState,
      rawLine: installment.rawLine,
      rawPayload,
    };

    creationQueue.push({ purchaseRecord, installment, data });
    if (creationQueue.length >= INSTALLMENT_BATCH_SIZE) {
      await flushInstallmentQueue();
    }
  }

  await flushInstallmentQueue();

  return { createdInstallments, skippedInstallments, ignoredInstallments };
}

type CreateEventArgs = {
  statementImportId: number;
  userId: string;
  eventType: string;
  payload?: Prisma.InputJsonValue;
  cardPurchaseId?: number;
  cardInstallmentId?: number;
};

function enqueueEvent(
  eventBuffer: Prisma.CardImportEventCreateManyInput[],
  data: CreateEventArgs,
) {
  eventBuffer.push({
    statementImportId: data.statementImportId,
    userId: data.userId,
    eventType: data.eventType,
    payload: data.payload,
    cardPurchaseId: data.cardPurchaseId,
    cardInstallmentId: data.cardInstallmentId,
  });
}

async function flushEvents(tx: CardImportTransactionClient, buffer: Prisma.CardImportEventCreateManyInput[]) {
  if (!buffer.length) {
    return;
  }

  const batches = chunk(buffer, EVENT_BATCH_SIZE);
  for (const batch of batches) {
    await tx.cardImportEvent.createMany({
      data: batch,
    });
  }

  buffer.splice(0, buffer.length);
}

function mergeMetadata(
  metadata: Prisma.JsonValue | undefined,
  resolvedInstallmentCount: number | null | undefined,
): Prisma.InputJsonValue {
  const base = (metadata as Prisma.JsonObject | undefined) ?? {};
  return {
    ...base,
    installmentCount: resolvedInstallmentCount ?? base.installmentCount ?? null,
  };
}


function toDate(input: string): Date {
  const normalized = input.includes("T") ? input : `${input}T00:00:00.000Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new CardImportPersistenceError(`Invalid date: ${input}`, "INVALID_PAYLOAD");
  }
  return date;
}

function parseStatementMonth(input?: string | null): Date | null {
  if (!input) {
    return null;
  }
  const match = input.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new CardImportPersistenceError(`Invalid statement month: ${input}`, "INVALID_PAYLOAD");
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return new Date(Date.UTC(year, monthIndex, 1));
}

function resolveLineageState(purchase: PersistedPurchaseRecord): LineageState {
  if (purchase.isReversal) {
    return "REVERSED";
  }
  if (purchase.wasCreated) {
    return "NEW";
  }
  if (purchase.overrideApplied) {
    return "UPDATED";
  }
  return "MATCHED";
}

function resolveTransactionTimeout() {
  const minimumTimeout = 20000;
  const fallbackTimeout = 60000;
  const envValue = process.env.CARD_IMPORT_TRANSACTION_TIMEOUT_MS;
  const parsed = envValue ? Number(envValue) : NaN;
  if (!Number.isFinite(parsed)) {
    return fallbackTimeout;
  }
  return Math.max(parsed, minimumTimeout);
}

function buildPurchaseCreateInput(
  purchase: PreparedPurchase,
  session: CardImportSession,
  statementImportId: number,
): Prisma.CardPurchaseCreateManyInput {
  const metadata = mergeMetadata(purchase.metadata, purchase.resolvedInstallmentCount);
  const rawPayload = purchase.rawPayload as Prisma.InputJsonValue | undefined;
  return {
    description: purchase.description,
    normalizedDescription: purchase.normalizedDescription,
    purchaseDate: purchase.resolvedPurchaseDate,
    totalAmount: purchase.resolvedTotalAmount,
    auvpCategory: purchase.resolvedCategory ?? null,
    paymentMethod: "CARD",
    cardIdentifier: purchase.cardIdentifier ?? session.meta.cardIdentifier ?? null,
    cardPurchaseKey: purchase.cardPurchaseKey,
    statementImportId,
    metadata,
    rawPayload,
  };
}

type MinimalPurchaseRecord = {
  id: number;
  statementImportId: number | null;
};

function toPersistedPurchaseRecord(
  purchase: PreparedPurchase,
  prismaRecord: MinimalPurchaseRecord,
  wasCreated: boolean,
  categoryFallback?: string | null,
): PersistedPurchaseRecord {
  const resolvedCategory = purchase.resolvedCategory ?? categoryFallback ?? null;
  return {
    id: prismaRecord.id,
    statementImportId: prismaRecord.statementImportId,
    wasCreated,
    overrideApplied: purchase.overrideApplied,
    isReversal: Boolean(purchase.isReversal),
    totalAmount: purchase.resolvedTotalAmount,
    purchaseDate: purchase.resolvedPurchaseDate,
    statementMonth: purchase.statementMonth,
    resolvedInstallmentCount: purchase.resolvedInstallmentCount,
    description: purchase.description,
    resolvedCategory,
  };
}

async function loadEnvelopeLookup(tx: CardImportTransactionClient): Promise<EnvelopeLookup> {
  const envelopes = await tx.envelope.findMany({ select: { id: true, name: true } });
  const lookup: EnvelopeLookup = new Map();
  envelopes.forEach((envelope) => {
    const key = normalizeEnvelopeKey(envelope.name);
    if (key) {
      lookup.set(key, envelope.id);
    }
  });
  return lookup;
}

function resolveEnvelopeIdFromCategory(category: string | null | undefined, lookup: EnvelopeLookup): number | null {
  const normalized = normalizeEnvelopeKey(category);
  if (!normalized) {
    return null;
  }

  const direct = lookup.get(normalized);
  if (typeof direct === "number") {
    return direct;
  }

  const fallbackName = AUVP_ENVELOPE_FALLBACKS[normalized];
  if (!fallbackName) {
    return null;
  }

  const fallbackKey = normalizeEnvelopeKey(fallbackName);
  return lookup.get(fallbackKey) ?? null;
}

function normalizeEnvelopeKey(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function chunk<T>(input: T[], size: number): T[][] {
  if (size <= 0) {
    return [input];
  }
  const result: T[][] = [];
  for (let index = 0; index < input.length; index += size) {
    result.push(input.slice(index, index + size));
  }
  return result;
}
