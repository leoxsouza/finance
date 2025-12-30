import { geminiTransactionSchema, type GeminiExtractionResponse, type GeminiTransaction } from "@/lib/ai/schemas";
import { validateSingleTransaction } from "@/lib/ai/validation";

import type {
  CardImportDraft,
  CardInstallmentDraft,
  CardPurchaseDraft,
  CardPurchaseMetadata,
  NormalizationIssue,
} from "@/lib/types/card-import";
import { extractInstallmentDetails } from "./installments";
import { buildPurchaseKey, normalizeText } from "./keys";
import { logger } from "@/lib/logger";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BRAZILIAN_DATE_PATTERN = /^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/;
const DEFAULT_STATEMENT_YEAR = 2025;

export type NormalizeCardImportOptions = {
  statementMonth?: string; // YYYY-MM
  cardIdentifier?: string;
  importId: number | string;
  defaultYear?: number;
};

export function normalizeCardImport(
  response: GeminiExtractionResponse,
  options: NormalizeCardImportOptions,
): CardImportDraft {
  const purchases: CardPurchaseDraft[] = [];
  const installments: CardInstallmentDraft[] = [];
  const issues: NormalizationIssue[] = [];

  response.transactions.forEach((raw, index) => {
    const validation = validateSingleTransaction(raw, index);
    if ("issues" in validation) {
      issues.push(
        ...validation.issues.map((issue) => ({
          scope: "PURCHASE" as const,
          transactionIndex: issue.index,
          field: issue.field,
          message: issue.message,
          severity: "error" as const,
        })),
      );
      return;
    }

    const normalized = validation.transaction;
    const dateResult = inferPurchaseDate(raw.purchaseDate, raw.statementMonth ?? options.statementMonth, options.defaultYear);
    if (!dateResult.success) {
      issues.push({
        scope: "PURCHASE",
        transactionIndex: index,
        field: "purchaseDate",
        message: dateResult.error,
        severity: "error",
      });
      return;
    }

    const hasExplicitReversalFlag = typeof raw.isReversal === "boolean";
    const inferredReversalFromSign = raw.amount > 0;
    const inferredChargeFromSign = raw.amount < 0;

    const isReversal = hasExplicitReversalFlag ? Boolean(raw.isReversal) : inferredReversalFromSign;
    const isCharge = hasExplicitReversalFlag ? !Boolean(raw.isReversal) : inferredChargeFromSign;
    const shouldCreatePurchase = isCharge || isReversal;
    if (!shouldCreatePurchase) {
      issues.push({
        scope: "PURCHASE",
        transactionIndex: index,
        message: "Transação de crédito ignorada (não gera gasto AUVP)",
        severity: "warning",
      });
      return;
    }

    const installmentDetails = extractInstallmentDetails({
      installmentNumber: raw.installmentNumber,
      installmentCount: raw.installmentCount,
      rawLine: raw.rawLine ?? undefined,
      description: raw.description,
      amount: raw.amount,
    });

    // Special logging for GOL LINHAS transaction
    if (raw.description?.includes('GOL') || raw.rawLine?.includes('GOL')) {
      logger.error("GOL LINHAS TRANSACTION DEBUG", {
        transactionIndex: index,
        description: raw.description,
        rawLine: raw.rawLine,
        aiProvidedInstallmentNumber: raw.installmentNumber,
        aiProvidedInstallmentCount: raw.installmentCount,
        amount: raw.amount,
        installmentDetails,
        purchaseDate: dateResult.date
      });
    }

    logger.debug("Installment details extracted for transaction", {
      transactionIndex: index,
      description: raw.description,
      rawLine: raw.rawLine,
      installmentDetails,
      aiProvidedInstallmentNumber: raw.installmentNumber,
      aiProvidedInstallmentCount: raw.installmentCount
    });

    const purchaseAmount = Number(Math.abs(raw.amount).toFixed(2));
    if (!purchaseAmount) {
      issues.push({
        scope: "PURCHASE",
        transactionIndex: index,
        field: "totalAmount",
        message: "Não foi possível determinar o valor total do gasto",
        severity: "error",
      });
      return;
    }

    if (installmentDetails && installmentDetails.installmentCount && installmentDetails.installmentNumber) {
      if (installmentDetails.installmentNumber > installmentDetails.installmentCount) {
        issues.push({
          scope: "INSTALLMENT",
          transactionIndex: index,
          field: "installmentNumber",
          message: "Número da parcela maior que o total de parcelas",
          severity: "warning",
        });
      }
    }

    const normalizedDescription = normalizedDescriptionFor(raw.description);
    const purchaseKey = buildPurchaseKey({
      description: normalizedDescription,
      purchaseDate: dateResult.date,
      totalAmount: purchaseAmount,
      cardIdentifier: raw.cardLastDigits ?? options.cardIdentifier,
      isInstallment: !!installmentDetails,
      installmentCount: installmentDetails?.installmentCount ?? null,
    });

    logger.debug("Purchase key generated", {
      transactionIndex: index,
      description: raw.description,
      normalizedDescription,
      purchaseDate: dateResult.date,
      totalAmount: purchaseAmount,
      cardIdentifier: raw.cardLastDigits ?? options.cardIdentifier,
      purchaseKey
    });

    const purchase: CardPurchaseDraft = {
      description: raw.description.trim(),
      normalizedDescription,
      purchaseDate: dateResult.date,
      totalAmount: purchaseAmount,
      statementMonth: raw.statementMonth ?? options.statementMonth,
      auvpCategory: normalized.type,
      isReversal,
      cardIdentifier: raw.cardLastDigits ?? options.cardIdentifier,
      cardPurchaseKey: purchaseKey,
      metadata: buildPurchaseMetadata(raw, installmentDetails),
      rawPayload: raw,
    };

    purchases.push(purchase);

    if (installmentDetails) {
      const installmentAmount = Number(
        (installmentDetails.installmentAmount ?? Math.abs(raw.amount)).toFixed(2),
      );

      const installment = {
        cardPurchaseKey: purchase.cardPurchaseKey,
        installmentNumber: installmentDetails.installmentNumber ?? 1,
        installmentCount: installmentDetails.installmentCount,
        installmentAmount,
        statementMonth: raw.statementMonth ?? options.statementMonth,
        rawLine: raw.rawLine ?? raw.description,
        rawPayload: raw,
      };

      logger.debug("Installment created", {
        transactionIndex: index,
        cardPurchaseKey: purchase.cardPurchaseKey,
        installmentNumber: installment.installmentNumber,
        installmentCount: installment.installmentCount,
        installmentAmount,
        rawLine: installment.rawLine
      });

      installments.push(installment);
    } else {
      logger.debug("No installment details - skipping installment creation", {
        transactionIndex: index,
        description: raw.description,
        rawLine: raw.rawLine
      });
    }
  });
  return {
    purchases,
    installments,
    issues,
  };
}

function inferPurchaseDate(
  rawDate: string,
  statementMonth?: string,
  defaultYear: number = DEFAULT_STATEMENT_YEAR,
): { success: true; date: string } | { success: false; error: string } {
  const trimmed = rawDate.trim();
  if (!trimmed) {
    return { success: false, error: "Data da compra ausente" };
  }

  if (ISO_DATE_PATTERN.test(trimmed)) {
    return { success: true, date: trimmed };
  }

  const match = trimmed.match(BRAZILIAN_DATE_PATTERN);
  if (!match) {
    return { success: false, error: "Formato de data não suportado" };
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearFromInput = match[3] ? Number(match[3]) : undefined;
  const statementInfo = parseStatementMonth(statementMonth);
  const baseYear = yearFromInput ?? statementInfo?.year ?? defaultYear;

  let year = baseYear;
  if (!yearFromInput && statementInfo) {
    if (month > statementInfo.month) {
      year = statementInfo.year - 1;
    } else {
      year = statementInfo.year;
    }
  }

  const iso = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  try {
    geminiTransactionSchema.shape.purchaseDate.parse(iso);
    return { success: true, date: iso };
  } catch {
    return { success: false, error: "Data da compra inválida" };
  }
}

function parseStatementMonth(statementMonth?: string | null): { year: number; month: number } | null {
  if (!statementMonth) {
    return null;
  }
  const [yearStr, monthStr] = statementMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  return { year, month };
}

function buildPurchaseMetadata(raw: GeminiTransaction, installmentDetails: ReturnType<typeof extractInstallmentDetails>): CardPurchaseMetadata {
  return {
    rawStatementMonth: raw.statementMonth,
    cardLastDigits: raw.cardLastDigits,
    installmentNumber: installmentDetails?.installmentNumber ?? raw.installmentNumber ?? null,
    installmentCount: installmentDetails?.installmentCount ?? raw.installmentCount ?? null,
  };
}

function normalizedDescriptionFor(description: string): string {
  return normalizeText(description).replace(/\s+/g, " ");
}
