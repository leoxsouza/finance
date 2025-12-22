export type CardStatementImportMeta = {
  id: number;
  fileHash: string;
  fileName: string;
  fileSize: number;
  statementMonth?: string; // ISO string
  cardIdentifier?: string;
};

export type CardPurchaseDraft = {
  description: string;
  normalizedDescription: string;
  purchaseDate: string; // ISO yyyy-mm-dd
  totalAmount: number;
  auvpCategory?: string;
  cardIdentifier?: string;
  cardPurchaseKey: string;
  metadata?: Record<string, unknown>;
  rawPayload?: unknown;
};

export type CardInstallmentDraft = {
  cardPurchaseKey: string;
  installmentNumber: number;
  installmentCount?: number;
  installmentAmount: number;
  totalAmount?: number;
  statementMonth?: string; // ISO yyyy-mm
  dueDate?: string; // ISO date
  normalizedLineHash: string;
  rawLine?: string;
  rawPayload?: unknown;
};

export type NormalizationIssue = {
  scope: "PURCHASE" | "INSTALLMENT";
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
