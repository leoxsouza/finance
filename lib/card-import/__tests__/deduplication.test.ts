import { describe, it, expect } from "vitest";
import { normalizeText } from "@/lib/card-import/keys";

describe("Installment Deduplication", () => {
  it("should generate same normalized text for identical installments across different imports", () => {
    const line1 = "PARCELAS 12X MERCADO PAGO 1234567890";
    const line2 = "PARCELAS 12X MERCADO PAGO 1234567890";
    
    const normalized1 = normalizeText(line1);
    const normalized2 = normalizeText(line2);
    
    expect(normalized1).toBe(normalized2);
  });

  it("should normalize text consistently", () => {
    const testCases = [
      "PARCELAS 12X MERCADO PAGO 1234567890",
      "parcelas 12x mercado pago 1234567890",
      "PARCELAS   12X   MERCADO   PAGO   1234567890",
      "PARCELAS 12X MERCADO PAGO 1234567890 ",
    ];
    
    const normalized = testCases.map(text => normalizeText(text));
    
    // All should normalize to the same value
    normalized.forEach((value, index) => {
      if (index > 0) {
        expect(value).toBe(normalized[0]);
      }
    });
  });
});
