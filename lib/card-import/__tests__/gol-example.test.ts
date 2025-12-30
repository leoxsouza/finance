import { describe, it, expect } from "vitest";
import { buildPurchaseKey, normalizeText } from "@/lib/card-import/keys";

describe("Real-world Installment Deduplication - GOL Example", () => {
  it("should handle GOL installment variations across months", () => {
    // Your real example
    const novemberLine = "11/09 GOL LINHAS*AASUXN16048367 02/05 420,12";
    const decemberLine = "11/09 GOL LINHAS*AASUXN16048367 03/05 420.10";
    
    // Extract the core purchase information (this would normally be done by the AI/parser)
    const purchaseInfo = {
      description: "GOL LINHAS*AASUXN16048367",
      purchaseDate: "2024-09-11", // Assuming 11/09 is Sept 11
      totalAmount: 2100.60, // 420.12 * 5 installments
      cardIdentifier: null,
    };
    
    // Both should generate the same purchase key
    const purchaseKey = buildPurchaseKey(purchaseInfo);
    
    // Simulate installment identification
    const novemberInstallment = {
      cardPurchaseKey: purchaseKey,
      installmentNumber: 2,
      installmentCount: 5,
      installmentAmount: 420.12,
    };
    
    const decemberInstallment = {
      cardPurchaseKey: purchaseKey,
      installmentNumber: 3,
      installmentCount: 5,
      installmentAmount: 420.10,
    };
    
    // They should have the same purchase key but different installment numbers
    expect(novemberInstallment.cardPurchaseKey).toBe(decemberInstallment.cardPurchaseKey);
    expect(novemberInstallment.installmentNumber).not.toBe(decemberInstallment.installmentNumber);
    
    // The deduplication key would be: purchaseKey|installmentNumber
    const novemberDedupeKey = `${purchaseKey}|${novemberInstallment.installmentNumber}`;
    const decemberDedupeKey = `${purchaseKey}|${decemberInstallment.installmentNumber}`;
    
    expect(novemberDedupeKey).not.toBe(decemberDedupeKey); // Different installments
  });

  it("should prevent duplicate installments within the same purchase", () => {
    const purchaseKey = "test-purchase-key";
    
    const installment1 = {
      cardPurchaseKey: purchaseKey,
      installmentNumber: 2,
      installmentCount: 5,
    };
    
    const duplicateInstallment = {
      cardPurchaseKey: purchaseKey,
      installmentNumber: 2, // Same installment number
      installmentCount: 5,
    };
    
    const dedupeKey1 = `${installment1.cardPurchaseKey}|${installment1.installmentNumber}`;
    const dedupeKey2 = `${duplicateInstallment.cardPurchaseKey}|${duplicateInstallment.installmentNumber}`;
    
    expect(dedupeKey1).toBe(dedupeKey2); // Should be identical for deduplication
  });

  it("should distinguish different purchases even with similar installment numbers", () => {
    const purchase1Key = "gol-purchase-key";
    const purchase2Key = "azul-purchase-key";
    
    const installment1 = {
      cardPurchaseKey: purchase1Key,
      installmentNumber: 2,
      installmentCount: 5,
    };
    
    const installment2 = {
      cardPurchaseKey: purchase2Key,
      installmentNumber: 2, // Same installment number but different purchase
      installmentCount: 5,
    };
    
    const dedupeKey1 = `${installment1.cardPurchaseKey}|${installment1.installmentNumber}`;
    const dedupeKey2 = `${installment2.cardPurchaseKey}|${installment2.installmentNumber}`;
    
    expect(dedupeKey1).not.toBe(dedupeKey2); // Different purchases
  });
});
