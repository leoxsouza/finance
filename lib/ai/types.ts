export type AuvpCategory =
  | "Custos fixos"
  | "Conforto"
  | "Prazeres"
  | "Metas"
  | "Liberdade Financeira"
  | "Conhecimento";

export type ExtractedTransactionType = AuvpCategory;

export type ExtractedTransactionCandidate = {
  purchaseDate: string; // ISO yyyy-mm-dd
  description: string;
  amount: number;
  type: ExtractedTransactionType;
};

export type ValidationIssue = {
  index: number;
  field: string;
  message: string;
};

export type ExtractionValidationResult = {
  valid: ExtractedTransactionCandidate[];
  invalid: ValidationIssue[];
};
