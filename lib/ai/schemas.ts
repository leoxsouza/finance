import { z } from "zod";

export const geminiTransactionSchema = z.object({
  date: z.string().min(1, "date cannot be empty").describe("Transaction date in ISO or statement format"),
  description: z.string().default("").describe("Full description from the statement"),
  amount: z.number().finite().describe("Numeric value, negative for debits and positive for credits"),
  type: z.string().min(1, "type cannot be empty"),
});

export const geminiExtractionResponseSchema = z.object({
  transactions: z.array(geminiTransactionSchema).default([]),
});

export type GeminiTransaction = z.infer<typeof geminiTransactionSchema>;
export type GeminiExtractionResponse = z.infer<typeof geminiExtractionResponseSchema>;
