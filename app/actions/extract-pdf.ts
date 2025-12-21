"use server";

import { z } from "zod";

import { requestGeminiExtraction } from "@/lib/ai/client";
import { ExtractionError, isExtractionError } from "@/lib/ai/errors";
import { GEMINI_LIMITS } from "@/lib/ai/config";
import { validateExtractionResponse } from "@/lib/ai/validation";
import type { ExtractionValidationResult } from "@/lib/ai/types";
import { base64ToUint8Array, maybeStripFirstPage } from "@/lib/pdf/utils";

const inputSchema = z.object({
  fileBase64: z.string().min(1, "fileBase64 is required"),
  ignoreFirstPage: z.boolean().optional(),
});

export type ExtractTransactionsInput = z.infer<typeof inputSchema>;

export async function extractTransactionsFromPDF(payload: ExtractTransactionsInput): Promise<ExtractionValidationResult> {
  try {
    const { fileBase64, ignoreFirstPage } = inputSchema.parse(payload);
    const normalizedBase64 = await maybeStripFirstPage(fileBase64, ignoreFirstPage);

    const pdfBytes = base64ToUint8Array(normalizedBase64);
    if (pdfBytes.byteLength > GEMINI_LIMITS.maxPdfBytes) {
      throw new ExtractionError("PDF is larger than the supported limit", {
        code: "PDF_TOO_LARGE",
        status: 413,
      });
    }

    const sanitizedBase64 = normalizeBase64(normalizedBase64);
    const response = await requestGeminiExtraction({ pdfBase64: sanitizedBase64 });
    return validateExtractionResponse(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ExtractionError("Invalid extraction payload", { code: "INVALID_INPUT", cause: error, status: 400 });
    }
    if (isExtractionError(error)) {
      throw error;
    }
    console.error("[extractTransactionsFromPDF] Unexpected error", error);
    throw new ExtractionError("Unexpected extraction failure", { cause: error });
  }
}

function normalizeBase64(input: string) {
  return input.replace(/^data:application\/pdf;base64,/, "");
}
