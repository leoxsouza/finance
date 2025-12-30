import { describe, it, expect } from "vitest";
import { buildPurchaseKey } from "../keys";

describe("Purchase Key with Reversals", () => {
  it("should generate different keys for installment purchases with different amounts", () => {
    const basePurchase = {
      description: "GOL LINHAS*AASUXN16048367",
      purchaseDate: "2024-11-09",
      totalAmount: 2100.60,
      cardIdentifier: "1234",
      isInstallment: true,
      installmentCount: 5,
    };

    const purchaseWithReversal = {
      description: "GOL LINHAS*AASUXN16048367",
      purchaseDate: "2024-11-09",
      totalAmount: 1680.48, // After reversal of 420.12
      cardIdentifier: "1234",
      isInstallment: true,
      installmentCount: 5,
    };

    const key1 = buildPurchaseKey(basePurchase);
    const key2 = buildPurchaseKey(purchaseWithReversal);

    expect(key1).not.toBe(key2); // Different amounts should generate different keys
    expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hash
    expect(key2).toMatch(/^[a-f0-9]{64}$/); // SHA256 hash
  });

  it("should generate different keys for different purchases", () => {
    const purchase1 = {
      description: "GOL LINHAS*AASUXN16048367",
      purchaseDate: "2024-11-09",
      totalAmount: 2100.60,
      cardIdentifier: "1234",
      isInstallment: false,
    };

    const purchase2 = {
      description: "MERCADO PAGAMENTOS*LOJA",
      purchaseDate: "2024-11-09",
      totalAmount: 150.00,
      cardIdentifier: "1234",
      isInstallment: false,
    };

    const key1 = buildPurchaseKey(purchase1);
    const key2 = buildPurchaseKey(purchase2);

    expect(key1).not.toBe(key2);
  });

  it("should generate different keys for different dates", () => {
    const purchase1 = {
      description: "GOL LINHAS*AASUXN16048367",
      purchaseDate: "2024-11-09",
      totalAmount: 2100.60,
      cardIdentifier: "1234",
      isInstallment: false,
    };

    const purchase2 = {
      description: "GOL LINHAS*AASUXN16048367",
      purchaseDate: "2024-12-09",
      totalAmount: 2100.60,
      cardIdentifier: "1234",
      isInstallment: false,
    };

    const key1 = buildPurchaseKey(purchase1);
    const key2 = buildPurchaseKey(purchase2);

    expect(key1).not.toBe(key2);
  });

  it("should generate different keys for different cards", () => {
    const purchase1 = {
      description: "GOL LINHAS*AASUXN16048367",
      purchaseDate: "2024-11-09",
      totalAmount: 2100.60,
      cardIdentifier: "1234",
      isInstallment: false,
    };

    const purchase2 = {
      description: "GOL LINHAS*AASUXN16048367",
      purchaseDate: "2024-11-09",
      totalAmount: 2100.60,
      cardIdentifier: "5678",
      isInstallment: false,
    };

    const key1 = buildPurchaseKey(purchase1);
    const key2 = buildPurchaseKey(purchase2);

    expect(key1).not.toBe(key2);
  });
});
