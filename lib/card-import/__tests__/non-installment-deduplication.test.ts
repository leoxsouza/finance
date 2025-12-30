import { describe, it, expect } from "vitest";
import { buildPurchaseKey } from "../keys";

describe("Non-Installment Deduplication Rules", () => {
  it("should generate different keys for non-installment purchases with same description/date but different amounts", () => {
    const purchase1 = {
      description: "UBER* TRIP",
      purchaseDate: "2024-03-11",
      totalAmount: 24.92,
      cardIdentifier: "1234",
      isInstallment: false,
    };

    const purchase2 = {
      description: "UBER* TRIP",
      purchaseDate: "2024-03-11",
      totalAmount: 21.94, // Different amount
      cardIdentifier: "1234",
      isInstallment: false,
    };

    const key1 = buildPurchaseKey(purchase1);
    const key2 = buildPurchaseKey(purchase2);

    expect(key1).not.toBe(key2); // Should be different UUIDs
    expect(key1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/); // UUID format
    expect(key2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/); // UUID format
  });

  it("should generate different keys even for identical non-installment purchases", () => {
    const purchase = {
      description: "MERCADO PAGAMENTOS*LOJA",
      purchaseDate: "2024-03-11",
      totalAmount: 150.00,
      cardIdentifier: "1234",
      isInstallment: false,
    };

    const key1 = buildPurchaseKey(purchase);
    const key2 = buildPurchaseKey(purchase);

    expect(key1).not.toBe(key2); // Should be different UUIDs even for identical purchases
    expect(key1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/); // UUID format
    expect(key2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/); // UUID format
  });

  it("should still apply deduplication for installment purchases", () => {
    const installment1 = {
      description: "GOL LINHAS*AASUXN16048367",
      purchaseDate: "2024-11-09",
      totalAmount: 420.10,
      cardIdentifier: "1234",
      isInstallment: true,
      installmentCount: 5,
    };

    const installment2 = {
      description: "GOL LINHAS*AASUXN16048367",
      purchaseDate: "2024-11-09",
      totalAmount: 420.10,
      cardIdentifier: "1234",
      isInstallment: true,
      installmentCount: 5,
    };

    const key1 = buildPurchaseKey(installment1);
    const key2 = buildPurchaseKey(installment2);

    expect(key1).toBe(key2); // Should be same key for identical installment purchases
  });

  it("should generate different keys for installment purchases with different installment counts", () => {
    const installment1 = {
      description: "AZUL LINHAS",
      purchaseDate: "2024-11-10",
      totalAmount: 300.00,
      cardIdentifier: "1234",
      isInstallment: true,
      installmentCount: 3,
    };

    const installment2 = {
      description: "AZUL LINHAS",
      purchaseDate: "2024-11-10",
      totalAmount: 300.00,
      cardIdentifier: "1234",
      isInstallment: true,
      installmentCount: 5,
    };

    const key1 = buildPurchaseKey(installment1);
    const key2 = buildPurchaseKey(installment2);

    expect(key1).not.toBe(key2); // Should be different keys due to different installment counts
  });
});
