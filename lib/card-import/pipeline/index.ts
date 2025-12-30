import { randomUUID } from "node:crypto";

import { requestGeminiExtraction } from "@/lib/ai/client";
import { normalizeCardImport } from "@/lib/card-import/normalization";
import type { CardImportSession, CardImportDraft } from "@/lib/types/card-import";

import type { CardImportActionInput } from "./input";
import { preparePdfPayload } from "./pdf";
import { runStage } from "./stageRunner";

type PipelineDeps = {
  preparePdfPayload: typeof preparePdfPayload;
  requestGeminiExtraction: typeof requestGeminiExtraction;
  normalizeCardImport: typeof normalizeCardImport;
  generateSessionId: () => string;
  now: () => Date;
};

const defaultDeps: PipelineDeps = {
  preparePdfPayload,
  requestGeminiExtraction,
  normalizeCardImport,
  generateSessionId: () => randomUUID(),
  now: () => new Date(),
};


type BuildSessionArgs = {
  sessionId: string;
  draft: CardImportDraft;
  input: CardImportActionInput;
  pdfBytes: number;
  rawTransactions: number;
  generatedAt: string;
  fileHash: string;
};

export async function runCardImportPipeline(
  input: CardImportActionInput,
  overrides: Partial<PipelineDeps> = {},
): Promise<CardImportSession> {
  const deps = { ...defaultDeps, ...overrides } satisfies PipelineDeps;
  const sessionId = deps.generateSessionId();
  const now = deps.now();

  const pdfPayload = await runStage(
    "prepare-pdf",
    () => deps.preparePdfPayload({ fileBase64: input.fileBase64, ignoreFirstPage: input.ignoreFirstPage }),
    (result) => ({ pdfBytes: result.byteLength }),
  );

  const extraction = await runStage(
    "gemini-extraction",
    () =>
      deps.requestGeminiExtraction({
        pdfBase64: pdfPayload.sanitizedBase64,
        promptOverride: input.promptOverride,
        modelOverride: input.modelOverride,
      }),
    (result) => ({ rawTransactions: result.transactions.length }),
  );

  const draft = await runStage(
    "normalize",
    () =>
      deps.normalizeCardImport(extraction, {
        statementMonth: input.statementMonth,
        cardIdentifier: input.cardIdentifier,
        importId: sessionId,
        defaultYear: now.getFullYear(),
      }),
    (result) => ({
      purchases: result.purchases.length,
      installments: result.installments.length,
      issues: result.issues.length,
    }),
  );

  return runStage(
    "build-session",
    () =>
      buildSession({
        sessionId,
        draft,
        input,
        pdfBytes: pdfPayload.byteLength,
        rawTransactions: extraction.transactions.length,
        generatedAt: now.toISOString(),
        fileHash: pdfPayload.fileHash,
      }),
    (result) => ({
      purchases: result.purchases.length,
      installments: result.installments.length,
      issues: result.issues.length,
    }),
  );
}

function buildSession({ sessionId, draft, input, pdfBytes, rawTransactions, generatedAt, fileHash }: BuildSessionArgs): CardImportSession {
  const fallbackStatementMonth = input.statementMonth ?? draft.purchases[0]?.statementMonth;
  const fallbackCardIdentifier = input.cardIdentifier ?? draft.purchases[0]?.cardIdentifier;
  const resolvedFileName = input.fileName ?? "card-import.pdf";
  const resolvedFileSize = input.fileSize ?? pdfBytes;

  return {
    sessionId,
    ...draft,
    meta: {
      statementMonth: fallbackStatementMonth,
      cardIdentifier: fallbackCardIdentifier,
      totalPurchases: draft.purchases.length,
      totalInstallments: draft.installments.length,
      totalIssues: draft.issues.length,
      pdfBytes,
      rawTransactions,
      generatedAt,
      fileName: resolvedFileName,
      fileSize: resolvedFileSize,
      fileHash,
    },
  };
}
