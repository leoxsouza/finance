export type ExtractionErrorCode = "INVALID_INPUT" | "PDF_TOO_LARGE" | "AI_FAILURE" | "INVALID_RESPONSE" | "TIMEOUT" | "UNKNOWN";

type ExtractionErrorOptions = {
  code?: ExtractionErrorCode;
  cause?: unknown;
  status?: number;
};

export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;
  readonly status: number;

  constructor(message: string, { code = "UNKNOWN", cause, status = 500 }: ExtractionErrorOptions = {}) {
    if (cause) {
      super(message, { cause });
    } else {
      super(message);
    }
    this.name = "ExtractionError";
    this.code = code;
    this.status = status;
  }
}

export function isExtractionError(error: unknown): error is ExtractionError {
  return error instanceof ExtractionError;
}
