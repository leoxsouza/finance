import { z } from "zod";

import prisma from "@/lib/db";
import finance from "@/lib/finance";
import type { CardImportSession, CardPurchaseOverrideMap } from "@/lib/types/card-import";

import {
  mapPurchaseToSummaryDTO,
  mapStatementImportSummary,
  mapStatementImportToDTO,
  type CardPurchaseSummaryDTO,
  type CardStatementImportDTO,
  type CardStatementImportSummaryDTO,
} from "./dto";
import { CardImportPersistenceError, saveImportSession } from "./persistence";

type PersistCardStatementParams = {
  session: CardImportSession;
  overrides?: CardPurchaseOverrideMap;
  userId: string;
  force?: boolean;
};

type PersistCardStatementResult = {
  summary: Awaited<ReturnType<typeof saveImportSession>>;
  statement: CardStatementImportDTO;
};

export async function persistCardStatementImport({ session, overrides, userId, force }: PersistCardStatementParams): Promise<PersistCardStatementResult> {
  if (!session.meta?.fileHash) {
    throw new CardImportPersistenceError("Card import session is missing file hash", "MISSING_FILE_HASH");
  }

  if (!force) {
    const existing = await prisma.cardStatementImport.findUnique({ where: { fileHash: session.meta.fileHash } });
    if (existing) {
      throw new CardImportPersistenceError("Statement import already exists for this file", "DUPLICATE_IMPORT");
    }
  }

  const summary = await saveImportSession({ session, overrides, userId, force });

  const statementRecord = await prisma.cardStatementImport.findUnique({
    where: { id: summary.statementImportId },
    include: {
      purchases: { include: { installments: true } },
      events: true,
    },
  });

  if (!statementRecord) {
    throw new Error(`Unable to load statement import ${summary.statementImportId}`);
  }

  return {
    summary,
    statement: mapStatementImportToDTO(statementRecord),
  };
}

export async function getCardStatementImport(id: number): Promise<CardStatementImportDTO | null> {
  const statementRecord = await prisma.cardStatementImport.findUnique({
    where: { id },
    include: {
      purchases: { include: { installments: true } },
      events: true,
    },
  });

  if (!statementRecord) {
    return null;
  }

  return mapStatementImportToDTO(statementRecord);
}

const listStatementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.coerce.number().int().positive().optional(),
});

export type ListCardStatementsParams = z.input<typeof listStatementsQuerySchema>;

export async function listCardStatementImports(params: ListCardStatementsParams = {}): Promise<{
  items: CardStatementImportSummaryDTO[];
  nextCursor?: number;
}> {
  const { limit = 10, cursor } = listStatementsQuerySchema.parse(params);

  const statements = await prisma.cardStatementImport.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { purchases: true, installments: true } },
    },
  });

  const hasNext = statements.length > limit;
  const sliced = hasNext ? statements.slice(0, -1) : statements;

  return {
    items: sliced.map(mapStatementImportSummary),
    nextCursor: hasNext ? statements[statements.length - 1].id : undefined,
  };
}

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be in YYYY-MM format"),
});

export type ListCardPurchasesParams = {
  month?: string;
};

export async function listCardPurchasesByMonth(params: ListCardPurchasesParams = {}): Promise<CardPurchaseSummaryDTO[]> {
  const resolvedMonth = params.month ? monthQuerySchema.parse({ month: params.month }).month : finance.getCurrentMonth();
  const { start, end } = finance.getMonthRange(resolvedMonth);

  const purchases = await prisma.cardPurchase.findMany({
    where: {
      purchaseDate: {
        gte: start,
        lt: end,
      },
    },
    orderBy: [{ purchaseDate: "asc" }, { id: "asc" }],
    include: {
      installments: true,
    },
  });

  return purchases.map(mapPurchaseToSummaryDTO);
}
