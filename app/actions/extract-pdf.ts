"use server";

import { ExtractionError, isExtractionError } from "@/lib/ai/errors";
import { parseCardImportActionInput } from "@/lib/card-import/pipeline/input";
import { runCardImportPipeline } from "@/lib/card-import/pipeline";
import type { CardImportSession } from "@/lib/types/card-import";

const ALLOW_OVERRIDES = process.env.CARD_IMPORT_ALLOW_OVERRIDES === "true";

export async function extractTransactionsFromPDF(payload: unknown): Promise<CardImportSession> {
  try {
    const parsed = parseCardImportActionInput(payload);
    const sanitized = ALLOW_OVERRIDES ? parsed : { ...parsed, promptOverride: undefined, modelOverride: undefined };

    return await runCardImportPipeline(sanitized);
  } catch (error) {
    if (isExtractionError(error)) {
      throw error;
    }
    console.error("[extractTransactionsFromPDF] Unexpected error", error);
    throw new ExtractionError("Unexpected extraction failure", { cause: error });
  }
}
