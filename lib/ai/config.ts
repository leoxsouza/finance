const DEFAULT_EXTRACTION_MODEL = "models/gemini-3-flash-preview";
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_TIMEOUT_MS = 450000;
const DEFAULT_MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export type GeminiConfig = {
  model?: string;
  temperature?: number;
  timeoutMs?: number;
};

function readEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required to use Gemini features`);
  }
  return value;
}

export function getGeminiApiKey(): string {
  return readEnv("GEMINI_API_KEY");
}

export function getGeminiExtractionConfig(overrides: GeminiConfig = {}) {
  return {
    model: overrides.model ?? DEFAULT_EXTRACTION_MODEL,
    temperature: overrides.temperature ?? DEFAULT_TEMPERATURE,
    timeoutMs: overrides.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxPdfBytes: DEFAULT_MAX_PDF_BYTES,
  } as const;
}

export const GEMINI_LIMITS = {
  maxPdfBytes: DEFAULT_MAX_PDF_BYTES,
} as const;

export const GEMINI_MODELS = {
  extraction: DEFAULT_EXTRACTION_MODEL,
} as const;
