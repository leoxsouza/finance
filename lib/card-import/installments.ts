import { parseBrazilianNumber } from "./numbers";
import { logger } from "@/lib/logger";

export type InstallmentDetails = {
  installmentNumber?: number;
  installmentCount?: number;
  installmentAmount?: number;
};

const FRACTION_PATTERN = /(\d{1,2})\s*\/\s*(\d{1,2})/i;
const PARCELA_PATTERN = /parcela\s*(\d{1,2})\s*(?:de|\/)?\s*(\d{1,2})/i;
const XR_PATTERN = /(\d{1,2})x\s*(?:de)?\s*(?:r\$)?\s*([\d.,]+)/i;
const LEADING_DATE_PATTERN = /^\s*\d{1,2}\s*[/-]\s*\d{1,2}(?:\s+|$)/;

export function extractInstallmentDetails(input: {
  installmentNumber?: number | null;
  installmentCount?: number | null;
  rawLine?: string | null;
  description?: string | null;
  amount: number;
}): InstallmentDetails | null {
  logger.debug("Extracting installment details", {
    input: {
      installmentNumber: input.installmentNumber,
      installmentCount: input.installmentCount,
      rawLine: input.rawLine,
      description: input.description,
      amount: input.amount
    }
  });

  // Check if AI provided installment info first
  const aiProvidedInstallments = !!(input.installmentNumber || input.installmentCount);
  logger.debug("AI provided installment info", { 
    hasInstallmentNumber: !!input.installmentNumber,
    hasInstallmentCount: !!input.installmentCount,
    aiProvidedInstallments
  });

  const directNumber = coercePositiveInt(input.installmentNumber);
  const directCount = coercePositiveInt(input.installmentCount);

  const sourceText = input.rawLine ?? input.description ?? "";
  const parsedFromText = parseFromText(sourceText, input.amount);

  logger.debug("Installment parsing results", {
    sourceText,
    directNumber,
    directCount,
    parsedFromText
  });

  const installmentNumber = directNumber ?? parsedFromText.installmentNumber;
  const installmentCount = directCount ?? parsedFromText.installmentCount;
  const installmentAmount = parsedFromText.installmentAmount ?? Math.abs(input.amount);

  if (!installmentNumber && !installmentCount && !parsedFromText.installmentAmount && !aiProvidedInstallments) {
    logger.debug("No installment details found - both AI and parsing failed", { 
      sourceText,
      aiInput: { installmentNumber: input.installmentNumber, installmentCount: input.installmentCount }
    });
    return null;
  }

  const result = {
    installmentNumber,
    installmentCount,
    installmentAmount,
  };

  logger.debug("Installment details extracted", result);
  return result;
}

function parseFromText(text: string, fallbackAmount: number): InstallmentDetails {
  if (!text) {
    return {};
  }

  const result: InstallmentDetails = {};
  let matched = false;
  const normalized = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  
  // Remove leading date pattern but keep the rest for installment parsing
  const cleanText = normalized.replace(LEADING_DATE_PATTERN, "").trim() || normalized;
  
  logger.debug("Parsing installment from text", {
    originalText: text,
    normalized,
    cleanText,
    fallbackAmount
  });
  
  // Look for fraction patterns AFTER removing dates
  const fractionMatch = cleanText.match(FRACTION_PATTERN);
  if (fractionMatch) {
    matched = true;
    result.installmentNumber = coercePositiveInt(Number(fractionMatch[1])) ?? result.installmentNumber;
    result.installmentCount = coercePositiveInt(Number(fractionMatch[2])) ?? result.installmentCount;
    logger.debug("Fraction pattern matched", { match: fractionMatch, result });
  }

  const parcelaMatch = cleanText.match(PARCELA_PATTERN);
  if (parcelaMatch) {
    matched = true;
    result.installmentNumber = coercePositiveInt(Number(parcelaMatch[1])) ?? result.installmentNumber;
    result.installmentCount = coercePositiveInt(Number(parcelaMatch[2])) ?? result.installmentCount;
    logger.debug("Parcela pattern matched", { match: parcelaMatch, result });
  }

  const xrMatch = cleanText.match(XR_PATTERN);
  if (xrMatch) {
    matched = true;
    result.installmentCount = coercePositiveInt(Number(xrMatch[1])) ?? result.installmentCount;
    const parsedAmount = parseBrazilianNumber(xrMatch[2]);
    if (parsedAmount) {
      result.installmentAmount = parsedAmount;
    }
    logger.debug("XR pattern matched", { match: xrMatch, result });
  }

  if (matched && !result.installmentAmount) {
    result.installmentAmount = Math.abs(fallbackAmount);
  }

  logger.debug("Text parsing completed", { matched, result });
  return matched ? result : {};
}

function coercePositiveInt(value?: number | null): number | undefined {
  if (typeof value !== "number") return undefined;
  const normalized = Math.trunc(Math.abs(value));
  return normalized > 0 ? normalized : undefined;
}
