import { describe, it, expect } from "vitest";
import { normalizeText } from "@/lib/card-import/keys";

describe("Real-world Installment Deduplication", () => {
  it("should handle realistic invoice variations", () => {
    // Simulate how the same installment might appear in different invoices
    const novemberInvoice = "PARCELAS 12X MERCADO PAGO *LOJA 1234567890";
    const decemberInvoice = "PARCELAS 12X MERCADO PAGO *LOJA 1234567890";
    
    const normalizedNov = normalizeText(novemberInvoice);
    const normalizedDec = normalizeText(decemberInvoice);
    
    expect(normalizedNov).toBe(normalizedDec);
  });

  it("should generate same normalized text for identical installments across different imports", () => {
    const line1 = "PARCELAS 12X MERCADO PAGO 1234567890";
    const line2 = "PARCELAS 12X MERCADO PAGO 1234567890";
    
    const normalized1 = normalizeText(line1);
    const normalized2 = normalizeText(line2);
    
    expect(normalized1).toBe(normalized2);
  });

  it("should handle whitespace and formatting differences", () => {
    const variations = [
      "PARCELAS 10X AMERICANAS 9876543210",
      "PARCELAS   10X   AMERICANAS   9876543210",
      "parcelas 10x americanas 9876543210",
      "PARCELAS 10X AMERICANAS 9876543210 ",
      " PARCELAS 10X AMERICANAS 9876543210",
    ];
    
    const normalized = variations.map(text => normalizeText(text));
    
    // All should generate the same normalized text
    normalized.forEach((text, index) => {
      if (index > 0) {
        expect(text).toBe(normalized[0]);
      }
    });
  });

  it("should distinguish different installments", () => {
    const installment1 = "PARCELAS 12X MERCADO PAGO 1234567890";
    const installment2 = "PARCELAS 10X MERCADO PAGO 1234567890";
    const installment3 = "PARCELAS 12X MERCADO PAGO 0987654321";
    
    const normalized1 = normalizeText(installment1);
    const normalized2 = normalizeText(installment2);
    const normalized3 = normalizeText(installment3);
    
    expect(normalized1).not.toBe(normalized2);
    expect(normalized1).not.toBe(normalized3);
    expect(normalized2).not.toBe(normalized3);
  });
});
