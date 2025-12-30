import { z } from "zod";

const nullableString = () => z.string().min(1).optional().nullable().default(null);
const nullableNumber = () => z.number().finite().optional().nullable().default(null);

export const geminiTransactionSchema = z.object({
  description: z.string().default("").describe("Full description from the statement"),
  amount: z.number().finite().describe("Numeric value, negative for debits and positive for credits"),
  type: z
    .string()
    .min(1, "type cannot be empty")
    .describe("Categoria AUVP {Custos fixos, Conforto, Prazeres, Metas, Liberdade Financeira, Conhecimento}"),
  purchaseDate: z
    .string()
    .min(1, "purchaseDate cannot be empty")
    .describe("Data da compra DD/MM ou ISO; Gemini deve inferir o ano"),
  statementMonth: nullableString().describe("Mês da fatura no formato YYYY-MM"),
  installmentNumber: nullableNumber().describe("Número da parcela atual"),
  installmentCount: nullableNumber().describe("Quantidade total de parcelas"),
  totalAmount: nullableNumber().describe("Valor total da compra; usar quando informado explicitamente"),
  cardLastDigits: nullableString().describe("Últimos dígitos do cartão quando presentes no PDF"),
  rawLine: nullableString().describe("Linha original usada pela IA para referência"),
  isReversal: z.boolean().optional().nullable().default(null).describe("Indica se a linha é estorno/ajuste"),
});

export const geminiExtractionResponseSchema = z.object({
  transactions: z.array(geminiTransactionSchema).default([]),
});

export const geminiInstallmentHintSchema = z.object({
  installmentNumber: nullableNumber(),
  installmentCount: nullableNumber(),
  installmentAmount: nullableNumber(),
  totalAmount: nullableNumber(),
}).describe("Metadados de parcelamento inferidos pelo Gemini");

export type GeminiTransaction = z.infer<typeof geminiTransactionSchema>;
export type GeminiExtractionResponse = z.infer<typeof geminiExtractionResponseSchema>;
export type GeminiInstallmentHint = z.infer<typeof geminiInstallmentHintSchema>;
