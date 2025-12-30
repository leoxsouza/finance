import type { Prisma } from "@prisma/client";

type StatementWithRelations = Prisma.CardStatementImportGetPayload<{
  include: {
    purchases: {
      include: {
        installments: true;
      };
    };
    events: true;
  };
}>;

type StatementSummaryRecord = Prisma.CardStatementImportGetPayload<{
  include: {
    _count: {
      select: {
        purchases: true;
        installments: true;
      };
    };
  };
}>;

type PurchaseWithInstallments = Prisma.CardPurchaseGetPayload<{
  include: {
    installments: true;
  };
}>;

type PurchaseSummaryRecord = Prisma.CardPurchaseGetPayload<{
  include: {
    installments: true;
  };
}>;

type InstallmentRecord = Prisma.CardInstallmentGetPayload<{
  include: Record<string, never>;
}>;

const toNumber = (value: Prisma.Decimal | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  return Number(value);
};

const toISODate = (value?: Date | null): string | null => (value ? value.toISOString() : null);

export type CardInstallmentDTO = {
  id: number;
  statementImportId: number;
  cardPurchaseId: number;
  installmentNumber: number;
  installmentCount: number | null;
  installmentAmount: number;
  statementMonth: string | null;
  dueDate: string | null;
  status: string;
  lineageState: string;
};

export type CardPurchaseDTO = {
  id: number;
  description: string;
  normalizedDescription: string | null;
  purchaseDate: string;
  totalAmount: number;
  auvpCategory: string | null;
  paymentMethod: string;
  cardIdentifier: string | null;
  cardPurchaseKey: string;
  statementImportId: number | null;
  metadata: Prisma.JsonValue | null;
  installments: CardInstallmentDTO[];
};

export type CardImportEventDTO = {
  id: number;
  eventType: string;
  createdAt: string;
  payload: Prisma.JsonValue | null;
  cardPurchaseId: number | null;
  cardInstallmentId: number | null;
};

export type CardStatementImportDTO = {
  id: number;
  fileName: string;
  fileHash: string;
  fileSize: number;
  status: string;
  statementMonth: string | null;
  cardIdentifier: string | null;
  createdAt: string;
  processedAt: string | null;
  purchases: CardPurchaseDTO[];
  events: CardImportEventDTO[];
};

export type CardStatementImportSummaryDTO = {
  id: number;
  fileName: string;
  fileHash: string;
  fileSize: number;
  status: string;
  statementMonth: string | null;
  cardIdentifier: string | null;
  createdAt: string;
  totalPurchases: number;
  totalInstallments: number;
};

export type CardPurchaseSummaryDTO = {
  id: number;
  description: string;
  purchaseDate: string;
  totalAmount: number;
  auvpCategory: string | null;
  cardIdentifier: string | null;
  statementImportId: number | null;
  installmentCount: number | null;
  pendingInstallments: number;
  completedInstallments: number;
};

export const mapInstallmentToDTO = (installment: InstallmentRecord): CardInstallmentDTO => ({
  id: installment.id,
  statementImportId: installment.statementImportId,
  cardPurchaseId: installment.cardPurchaseId,
  installmentNumber: installment.installmentNumber,
  installmentCount: installment.installmentCount ?? null,
  installmentAmount: Number(installment.installmentAmount),
  statementMonth: toISODate(installment.statementMonth),
  dueDate: toISODate(installment.dueDate),
  status: installment.status,
  lineageState: installment.lineageState,
});

export const mapPurchaseToDTO = (purchase: PurchaseWithInstallments): CardPurchaseDTO => ({
  id: purchase.id,
  description: purchase.description,
  normalizedDescription: purchase.normalizedDescription,
  purchaseDate: purchase.purchaseDate.toISOString(),
  totalAmount: toNumber(purchase.totalAmount) ?? 0,
  auvpCategory: purchase.auvpCategory ?? null,
  paymentMethod: purchase.paymentMethod,
  cardIdentifier: purchase.cardIdentifier ?? null,
  cardPurchaseKey: purchase.cardPurchaseKey,
  statementImportId: purchase.statementImportId ?? null,
  metadata: purchase.metadata,
  installments: purchase.installments.map(mapInstallmentToDTO),
});

export const mapEventToDTO = (event: Prisma.CardImportEventGetPayload<Record<string, never>>): CardImportEventDTO => ({
  id: event.id,
  eventType: event.eventType,
  createdAt: event.createdAt.toISOString(),
  payload: event.payload,
  cardPurchaseId: event.cardPurchaseId ?? null,
  cardInstallmentId: event.cardInstallmentId ?? null,
});

export const mapStatementImportToDTO = (statement: StatementWithRelations): CardStatementImportDTO => ({
  id: statement.id,
  fileName: statement.fileName,
  fileHash: statement.fileHash,
  fileSize: statement.fileSize,
  status: statement.status,
  statementMonth: toISODate(statement.statementMonth),
  cardIdentifier: statement.cardIdentifier ?? null,
  createdAt: statement.createdAt.toISOString(),
  processedAt: toISODate(statement.processedAt),
  purchases: statement.purchases.map(mapPurchaseToDTO),
  events: statement.events.map(mapEventToDTO).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
});

export const mapStatementImportSummary = (statement: StatementSummaryRecord): CardStatementImportSummaryDTO => ({
  id: statement.id,
  fileName: statement.fileName,
  fileHash: statement.fileHash,
  fileSize: statement.fileSize,
  status: statement.status,
  statementMonth: toISODate(statement.statementMonth),
  cardIdentifier: statement.cardIdentifier ?? null,
  createdAt: statement.createdAt.toISOString(),
  totalPurchases: statement._count.purchases,
  totalInstallments: statement._count.installments,
});

export const mapPurchaseToSummaryDTO = (purchase: PurchaseSummaryRecord): CardPurchaseSummaryDTO => {
  const installmentCountFromMetadata =
    purchase.metadata && typeof purchase.metadata === "object" && purchase.metadata !== null && "installmentCount" in purchase.metadata
      ? Number((purchase.metadata as Record<string, unknown>).installmentCount)
      : null;
  const pendingInstallments = purchase.installments.filter((installment) => installment.status === "PENDING").length;
  const completedInstallments = purchase.installments.filter((installment) => installment.status === "PAID").length;

  return {
    id: purchase.id,
    description: purchase.description,
    purchaseDate: purchase.purchaseDate.toISOString(),
    totalAmount: toNumber(purchase.totalAmount) ?? 0,
    auvpCategory: purchase.auvpCategory ?? null,
    cardIdentifier: purchase.cardIdentifier ?? null,
    statementImportId: purchase.statementImportId ?? null,
    installmentCount: installmentCountFromMetadata ?? purchase.installments.at(0)?.installmentCount ?? null,
    pendingInstallments,
    completedInstallments,
  };
};
