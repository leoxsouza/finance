import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";

const WHITESPACE_PATTERN = /\s+/g;
const DIACRITIC_PATTERN = /\p{Diacritic}/gu;

type PurchaseKeyInput = {
  description: string;
  purchaseDate: string;
  totalAmount: number;
  cardIdentifier?: string | null;
  isInstallment?: boolean;
  installmentCount?: number | null;
};

export function buildPurchaseKey({ description, purchaseDate, totalAmount, cardIdentifier, isInstallment, installmentCount }: PurchaseKeyInput): string {
  // For non-installment purchases, generate random UUID to never deduplicate
  if (!isInstallment) {
    return randomUUID();
  }
  
  // For installment purchases, use hash for proper deduplication
  const normalizedDescription = normalizeText(description);
  const normalizedCard = normalizeText(cardIdentifier ?? "");
  const payload = [normalizedDescription, purchaseDate, totalAmount.toString(), installmentCount?.toString() ?? "1", normalizedCard].join("|");
  return sha256(payload);
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITIC_PATTERN, "")
    .trim()
    .replace(WHITESPACE_PATTERN, " ")
    .toLowerCase();
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
