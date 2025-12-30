import { createHash } from "node:crypto";

import { GEMINI_LIMITS } from "@/lib/ai/config";
import { ExtractionError } from "@/lib/ai/errors";
import { base64ToUint8Array, maybeStripFirstPage } from "@/lib/pdf/utils";

const PDF_BASE64_PREFIX = /^data:application\/pdf;base64,/;

type PreparePdfOptions = {
  fileBase64: string;
  ignoreFirstPage?: boolean;
};

export type PreparedPdfPayload = {
  sanitizedBase64: string;
  byteLength: number;
  fileHash: string;
};

export async function preparePdfPayload({ fileBase64, ignoreFirstPage }: PreparePdfOptions): Promise<PreparedPdfPayload> {
  const base64 = await maybeStripFirstPage(fileBase64, ignoreFirstPage);
  const pdfBytes = base64ToUint8Array(base64);
  const fileHash = createHash("sha256").update(pdfBytes).digest("hex");

  if (pdfBytes.byteLength > GEMINI_LIMITS.maxPdfBytes) {
    throw new ExtractionError("PDF is larger than the supported limit", {
      code: "PDF_TOO_LARGE",
      status: 413,
    });
  }

  return {
    sanitizedBase64: stripPrefix(base64),
    byteLength: pdfBytes.byteLength,
    fileHash,
  };
}

function stripPrefix(input: string): string {
  if (!input) return input;
  return input.replace(PDF_BASE64_PREFIX, "");
}
