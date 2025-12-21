import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, type FilePart } from "ai";

import { ExtractionError } from "@/lib/ai/errors";
import { getGeminiApiKey, getGeminiExtractionConfig } from "@/lib/ai/config";
import { geminiExtractionResponseSchema } from "@/lib/ai/schemas";
import type { GeminiExtractionResponse } from "@/lib/ai/schemas";

const DEFAULT_USER_PROMPT =
  "Extraia todas as transações deste PDF. Ignore pagamentos consolidados, resumos, propagandas e tarifas automáticas. " +
  "Classifique cada linha como crédito ou débito e preserve descrições completas. Retorne em português.";

type ExtractionRequest = {
  pdfBase64: string;
  promptOverride?: string;
};

export async function requestGeminiExtraction({ pdfBase64, promptOverride }: ExtractionRequest): Promise<GeminiExtractionResponse> {
  const { model, temperature, timeoutMs } = getGeminiExtractionConfig();
  const apiKey = getGeminiApiKey();
  const provider = createGoogleGenerativeAI({ apiKey });
  const modelInstance = provider(model);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Gemini extraction timeout")), timeoutMs);

  try {
    const { object } = await generateObject({
      model: modelInstance,
      schema: geminiExtractionResponseSchema,
      abortSignal: controller.signal,
      temperature,
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente financeiro. Sua tarefa é analisar uma fatura de cartão e retornar apenas as transações individuais.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptOverride ?? DEFAULT_USER_PROMPT,
            },
            {
              type: "file",
              data: pdfBase64,
              mediaType: "application/pdf",
            } satisfies FilePart,
          ],
        },
      ],
    });

    return object;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ExtractionError("Gemini extraction timed out", { code: "TIMEOUT", cause: error, status: 504 });
    }
    throw new ExtractionError("Gemini extraction failed", { code: "AI_FAILURE", cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
