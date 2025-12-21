export type ExtractedTransactionType = "IN" | "OUT";

export type ExtractedTransactionCandidate = {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number; // always positive
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
