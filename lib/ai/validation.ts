import { geminiExtractionResponseSchema } from "./schemas";
import type { GeminiTransaction } from "./schemas";
import { ExtractionError } from "./errors";
import type {
  ExtractedTransactionCandidate,
  ExtractedTransactionType,
  ExtractionValidationResult,
  ValidationIssue,
} from "./types";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const AUVP_KEYWORDS: Record<string, ExtractedTransactionType> = {
  "custos fixos": "Custos fixos",
  conforto: "Conforto",
  prazer: "Prazeres",
  prazeres: "Prazeres",
  metas: "Metas",
  "liberdade financeira": "Liberdade Financeira",
  conhecimento: "Conhecimento",
};

export function normalizeGeminiTransaction(raw: GeminiTransaction): ExtractedTransactionCandidate {
  const type = mapType(raw.type);
  const amount = normalizeAmount(raw.amount);
  const date = normalizeDate(raw.purchaseDate);

  return {
    description: raw.description.trim(),
    amount,
    purchaseDate: date,
    type,
  };
}

export function validateExtractionResponse(input: unknown): ExtractionValidationResult {
  const parsed = geminiExtractionResponseSchema.safeParse(input);
  if (!parsed.success) {
    throw new ExtractionError("Gemini response did not match schema", { code: "INVALID_RESPONSE", cause: parsed.error });
  }

  const valid: ExtractedTransactionCandidate[] = [];
  const invalid: ValidationIssue[] = [];

  parsed.data.transactions.forEach((transaction, index) => {
    const result = validateSingleTransaction(transaction, index);
    if ("transaction" in result) {
      valid.push(result.transaction);
    } else {
      invalid.push(...result.issues);
    }
  });

  return { valid, invalid };
}

export function validateSingleTransaction(
  raw: GeminiTransaction,
  index: number,
): { transaction: ExtractedTransactionCandidate } | { issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (!raw.description || !raw.description.trim()) {
    issues.push({ index, field: "description", message: "Description is required" });
  }

  let normalizedDate: string | null = null;
  try {
    normalizedDate = normalizeDate(raw.purchaseDate);
  } catch {
    issues.push({ index, field: "date", message: "Invalid date format" });
  }

  let normalizedAmount: number | null = null;
  try {
    normalizedAmount = normalizeAmount(raw.amount);
  } catch {
    issues.push({ index, field: "amount", message: "Invalid amount" });
  }

  let normalizedType: ExtractedTransactionType | null = null;
  try {
    normalizedType = mapType(raw.type);
  } catch {
    issues.push({ index, field: "type", message: "Invalid type" });
  }

  if (issues.length > 0 || !normalizedDate || normalizedAmount === null || !normalizedType) {
    return { issues };
  }

  return {
    transaction: {
      description: raw.description.trim(),
      amount: normalizedAmount,
      purchaseDate: normalizedDate,
      type: normalizedType,
    },
  };
}

function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number");
  }

  const absolute = Math.abs(amount);
  if (absolute === 0) {
    throw new Error("Amount must be greater than zero");
  }

  return Number(absolute.toFixed(2));
}

function mapType(rawType: string): ExtractedTransactionType {
  const normalized = rawType.trim().toLowerCase();
  const mapped = AUVP_KEYWORDS[normalized];
  if (!mapped) {
    throw new Error("Unsupported transaction type");
  }
  return mapped;
}

function normalizeDate(input: string): string {
  const trimmed = input.trim();

  if (ISO_DATE_PATTERN.test(trimmed)) {
    if (!isValidDate(trimmed)) {
      throw new Error("Invalid ISO date");
    }
    return trimmed;
  }

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const iso = `${year}-${month}-${day}`;
    if (!isValidDate(iso)) {
      throw new Error("Invalid Brazilian date");
    }
    return iso;
  }

  throw new Error("Unsupported date format");
}

export function extractValidationSummary(result: ExtractionValidationResult) {
  return {
    total: result.valid.length + result.invalid.length,
    valid: result.valid.length,
    invalid: result.invalid.length,
  };
}

function isValidDate(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  // ensure preserving date components
  const [year, month, day] = value.split("-").map(Number);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}
