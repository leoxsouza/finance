export type CardStatementImportMeta = {
  id: number;
  fileHash: string;
  fileName: string;
  fileSize: number;
  statementMonth?: string; // ISO string
  cardIdentifier?: string;
};

export type CardPurchaseMetadata = {
  rawStatementMonth?: string | null;
  cardLastDigits?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
};

export type CardPurchaseDraft = {
  description: string;
  normalizedDescription: string;
  purchaseDate: string; // ISO yyyy-mm-dd
  totalAmount: number;
  statementMonth?: string;
  auvpCategory?: string;
  isReversal?: boolean;
  cardIdentifier?: string;
  cardPurchaseKey: string;
  metadata?: CardPurchaseMetadata;
  rawPayload?: unknown;
};

export type CardInstallmentDraft = {
  cardPurchaseKey: string;
  installmentNumber: number;
  installmentCount?: number;
  installmentAmount: number;
  statementMonth?: string; // ISO yyyy-mm
  dueDate?: string; // ISO date
  rawLine?: string;
  rawPayload?: unknown;
};

export type NormalizationIssue = {
  scope: "PURCHASE" | "INSTALLMENT";
  field?: string;
  transactionIndex?: number;
  cardPurchaseKey?: string;
  installmentNumber?: number;
  message: string;
  severity: "warning" | "error";
};

export type CardImportDraft = {
  purchases: CardPurchaseDraft[];
  installments: CardInstallmentDraft[];
  issues: NormalizationIssue[];
};

export type CardImportSessionMeta = {
  statementMonth?: string;
  cardIdentifier?: string;
  totalPurchases: number;
  totalInstallments: number;
  totalIssues: number;
  pdfBytes?: number;
  rawTransactions?: number;
  generatedAt: string;
  fileName?: string;
  fileSize?: number;
  fileHash?: string;
};

export type CardImportSession = CardImportDraft & {
  sessionId: string;
  meta: CardImportSessionMeta;
};

export type CardPurchaseOverride = {
  purchaseDate?: string;
  auvpCategory?: string;
  totalAmount?: number;
  installmentCount?: number;
};

export type CardPurchaseOverrideMap = Record<string, CardPurchaseOverride>;
