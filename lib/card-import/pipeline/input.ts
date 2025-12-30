import { z } from "zod";

import { ExtractionError } from "@/lib/ai/errors";

const STATEMENT_MONTH_PATTERN = /^\d{4}-\d{2}$/;

const cardImportInputSchema = z.object({
  fileBase64: z.string().min(1, "fileBase64 is required"),
  fileName: z.string().min(1).optional(),
  fileSize: z.number().int().positive().optional(),
  ignoreFirstPage: z.boolean().optional().default(false),
  statementMonth: z
    .string()
    .regex(STATEMENT_MONTH_PATTERN, "statementMonth must be in YYYY-MM format")
    .optional(),
  cardIdentifier: z.string().min(1).optional(),
  promptOverride: z.string().min(1).optional(),
  modelOverride: z.string().min(1).optional(),
});

export type CardImportActionInput = z.infer<typeof cardImportInputSchema>;

export function parseCardImportActionInput(input: unknown): CardImportActionInput {
  try {
    return cardImportInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ExtractionError("Invalid extraction payload", { code: "INVALID_INPUT", cause: error, status: 400 });
    }
    throw error;
  }
}
