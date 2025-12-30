import { PDFDocument } from "pdf-lib";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, type FilePart } from "ai";

import { ExtractionError } from "@/lib/ai/errors";
import { getGeminiApiKey, getGeminiExtractionConfig } from "@/lib/ai/config";
import { geminiExtractionResponseSchema } from "@/lib/ai/schemas";
import type { GeminiExtractionResponse, GeminiTransaction } from "@/lib/ai/schemas";
import { logger } from "@/lib/logger";
import { base64ToUint8Array, uint8ArrayToBase64 } from "@/lib/pdf/utils";

const PAGES_PER_CHUNK = 1;
const CHUNK_TIMEOUT_MS = 180000; // 3 minutes per chunk
const MAX_CONCURRENT_CHUNKS = 2;

type ChunkedExtractionRequest = {
  pdfBase64: string;
  systemPrompt: string;
  userPrompt: string;
  modelOverride?: string;
};

type PdfChunk = {
  index: number;
  base64: string;
  pageStart: number;
  pageEnd: number;
};

async function splitPdfIntoChunks(pdfBase64: string): Promise<PdfChunk[]> {
  const bytes = base64ToUint8Array(pdfBase64);
  const sourceDoc = await PDFDocument.load(bytes);
  const totalPages = sourceDoc.getPageCount();

  if (totalPages <= PAGES_PER_CHUNK) {
    return [{ index: 0, base64: pdfBase64, pageStart: 0, pageEnd: totalPages - 1 }];
  }

  const chunks: PdfChunk[] = [];
  let chunkIndex = 0;

  for (let pageStart = 0; pageStart < totalPages; pageStart += PAGES_PER_CHUNK) {
    const pageEnd = Math.min(pageStart + PAGES_PER_CHUNK - 1, totalPages - 1);
    const pageIndices = Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i);

    const chunkDoc = await PDFDocument.create();
    const copiedPages = await chunkDoc.copyPages(sourceDoc, pageIndices);
    copiedPages.forEach((page) => chunkDoc.addPage(page));

    const chunkBytes = await chunkDoc.save();
    const chunkBase64 = uint8ArrayToBase64(chunkBytes);

    chunks.push({
      index: chunkIndex,
      base64: chunkBase64,
      pageStart,
      pageEnd,
    });

    chunkIndex++;
  }

  logger.debug("PDF split into chunks", {
    totalPages,
    chunkCount: chunks.length,
    pagesPerChunk: PAGES_PER_CHUNK,
  });

  return chunks;
}

async function extractChunk(
  chunk: PdfChunk,
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number,
): Promise<GeminiTransaction[]> {
  const apiKey = getGeminiApiKey();
  const provider = createGoogleGenerativeAI({ apiKey });
  const modelInstance = provider(model);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error(`Chunk ${chunk.index} extraction timeout`)),
    CHUNK_TIMEOUT_MS,
  );

  try {
    logger.debug(`Processing chunk ${chunk.index}`, {
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
    });

    const { object } = await generateObject({
      model: modelInstance,
      schema: geminiExtractionResponseSchema,
      abortSignal: controller.signal,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "file", data: chunk.base64, mediaType: "application/pdf" } satisfies FilePart,
          ],
        },
      ],
    });

    logger.debug(`Chunk ${chunk.index} completed`, {
      transactionCount: object.transactions.length,
    });

    return object.transactions;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error(`Chunk ${chunk.index} timed out`, { pageStart: chunk.pageStart, pageEnd: chunk.pageEnd });
      throw new ExtractionError(`Chunk ${chunk.index} extraction timed out`, {
        code: "TIMEOUT",
        cause: error,
        status: 504,
      });
    }
    logger.error(`Chunk ${chunk.index} failed`, { error });
    throw new ExtractionError(`Chunk ${chunk.index} extraction failed`, { code: "AI_FAILURE", cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

async function processChunksWithConcurrency(
  chunks: PdfChunk[],
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number,
): Promise<GeminiTransaction[]> {
  const results: GeminiTransaction[][] = new Array(chunks.length);
  let currentIndex = 0;

  async function processNext(): Promise<void> {
    while (currentIndex < chunks.length) {
      const chunkIndex = currentIndex;
      currentIndex++;
      const chunk = chunks[chunkIndex];
      results[chunkIndex] = await extractChunk(chunk, systemPrompt, userPrompt, model, temperature);
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENT_CHUNKS, chunks.length) }, () => processNext());
  await Promise.all(workers);

  return results.flat();
}

export async function requestChunkedGeminiExtraction({
  pdfBase64,
  systemPrompt,
  userPrompt,
  modelOverride,
}: ChunkedExtractionRequest): Promise<GeminiExtractionResponse> {
  const { model, temperature } = getGeminiExtractionConfig(modelOverride ? { model: modelOverride } : undefined);

  const chunks = await splitPdfIntoChunks(pdfBase64);

  logger.debug("Starting chunked extraction", {
    chunkCount: chunks.length,
    model,
  });

  if (chunks.length === 1) {
    const transactions = await extractChunk(chunks[0], systemPrompt, userPrompt, model, temperature);
    return { transactions };
  }

  const transactions = await processChunksWithConcurrency(chunks, systemPrompt, userPrompt, model, temperature);

  logger.debug("Chunked extraction completed", {
    totalTransactions: transactions.length,
  });

  return { transactions };
}

export function shouldUseChunkedExtraction(pdfBase64: string): boolean {
  const bytes = base64ToUint8Array(pdfBase64);
  return bytes.byteLength > 100 * 1024; // Use chunked for PDFs > 100KB
}
