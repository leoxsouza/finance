import { describe, expect, it } from "vitest";

import type { GeminiTransaction } from "../../ai/schemas";
import { normalizeGeminiTransaction, validateExtractionResponse, extractValidationSummary } from "../../ai/validation";

describe("normalizeGeminiTransaction", () => {
  it("normalizes brazilian dates, amount, and type", () => {
    const candidate = normalizeGeminiTransaction({
      date: "13/09/2025",
      description: "Compra Supermercado ",
      amount: -123.45,
      type: "débito",
    });

    expect(candidate).toEqual({
      date: "2025-09-13",
      description: "Compra Supermercado",
      amount: 123.45,
      type: "OUT",
    });
  });
});

describe("validateExtractionResponse", () => {
  const validTransaction: GeminiTransaction = {
    date: "2025-09-13",
    description: "Salário",
    amount: 2500.75,
    type: "crédito",
  };

  it("returns valid transactions when payload is correct", () => {
    const { valid, invalid } = validateExtractionResponse({ transactions: [validTransaction] });
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });

  it("collects issues per record", () => {
    const faulty: GeminiTransaction = {
      date: "31-02-2025",
      description: "",
      amount: 0,
      type: "unknown",
    } as unknown as GeminiTransaction;

    const { valid, invalid } = validateExtractionResponse({ transactions: [validTransaction, faulty] });

    expect(valid).toHaveLength(1);
    expect(invalid).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "description" }),
        expect.objectContaining({ field: "date" }),
        expect.objectContaining({ field: "amount" }),
        expect.objectContaining({ field: "type" }),
      ]),
    );
  });

  it("summarizes totals", () => {
    const summary = extractValidationSummary({
      valid: [normalizeGeminiTransaction(validTransaction)],
      invalid: [{ index: 0, field: "date", message: "Invalid date" }],
    });

    expect(summary).toEqual({ total: 2, valid: 1, invalid: 1 });
  });
});
