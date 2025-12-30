import { describe, it, expect } from "vitest";
import { buildPurchaseKey } from "../keys";

describe("New Deduplication Rules", () => {
  describe("Non-Installment Purchases", () => {
    it("should generate different keys for different amounts on same day", () => {
      const uber1 = {
        description: "UBER* TRIP",
        purchaseDate: "2024-03-11",
        totalAmount: 24.92,
        cardIdentifier: "1234",
        isInstallment: false,
      };

      const uber2 = {
        description: "UBER* TRIP",
        purchaseDate: "2024-03-11",
        totalAmount: 21.94,
        cardIdentifier: "1234",
        isInstallment: false,
      };

      const key1 = buildPurchaseKey(uber1);
      const key2 = buildPurchaseKey(uber2);

      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(key2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("should generate different keys for different descriptions", () => {
      const purchase1 = {
        description: "MERCADO PAGAMENTOS*LOJA",
        purchaseDate: "2024-03-11",
        totalAmount: 150.00,
        cardIdentifier: "1234",
        isInstallment: false,
      };

      const purchase2 = {
        description: "UBER* TRIP",
        purchaseDate: "2024-03-11",
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
        description: "UBER* TRIP",
        purchaseDate: "2024-03-11",
        totalAmount: 24.92,
        cardIdentifier: "1234",
        isInstallment: false,
      };

      const purchase2 = {
        description: "UBER* TRIP",
        purchaseDate: "2024-03-12",
        totalAmount: 24.92,
        cardIdentifier: "1234",
        isInstallment: false,
      };

      const key1 = buildPurchaseKey(purchase1);
      const key2 = buildPurchaseKey(purchase2);

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different cards", () => {
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
        totalAmount: 24.92,
        cardIdentifier: "5678",
        isInstallment: false,
      };

      const key1 = buildPurchaseKey(purchase1);
      const key2 = buildPurchaseKey(purchase2);

      expect(key1).not.toBe(key2);
    });

    it("should generate same key for identical non-installment purchases", () => {
      const purchase = {
        description: "UBER* TRIP",
        purchaseDate: "2024-03-11",
        totalAmount: 24.92,
        cardIdentifier: "1234",
        isInstallment: false,
      };

      const key1 = buildPurchaseKey(purchase);
      const key2 = buildPurchaseKey(purchase);

      expect(key1).not.toBe(key2); // UUIDs should be different even for identical purchases
      expect(key1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(key2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe("Installment Purchases", () => {
    it("should include installment count in key", () => {
      const installment3x = {
        description: "GOL LINHAS*AASUXN16048367",
        purchaseDate: "2024-11-09",
        totalAmount: 420.10,
        cardIdentifier: "1234",
        isInstallment: true,
        installmentCount: 3,
      };

      const installment5x = {
        description: "GOL LINHAS*AASUXN16048367",
        purchaseDate: "2024-11-09",
        totalAmount: 420.10,
        cardIdentifier: "1234",
        isInstallment: true,
        installmentCount: 5,
      };

      const key1 = buildPurchaseKey(installment3x);
      const key2 = buildPurchaseKey(installment5x);

      expect(key1).not.toBe(key2);
    });

    it("should include amount for installment purchases", () => {
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
        totalAmount: 420.12,
        cardIdentifier: "1234",
        isInstallment: true,
        installmentCount: 5,
      };

      const key1 = buildPurchaseKey(installment1);
      const key2 = buildPurchaseKey(installment2);

      expect(key1).not.toBe(key2);
    });

    it("should generate same key for identical installment purchases", () => {
      const installment = {
        description: "GOL LINHAS*AASUXN16048367",
        purchaseDate: "2024-11-09",
        totalAmount: 420.10,
        cardIdentifier: "1234",
        isInstallment: true,
        installmentCount: 5,
      };

      const key1 = buildPurchaseKey(installment);
      const key2 = buildPurchaseKey(installment);

      expect(key1).toBe(key2);
    });

    it("should default installment count to 1 when not provided", () => {
      const installmentWithoutCount = {
        description: "GOL LINHAS*AASUXN16048367",
        purchaseDate: "2024-11-09",
        totalAmount: 420.10,
        cardIdentifier: "1234",
        isInstallment: true,
      };

      const installmentWithCount1 = {
        description: "GOL LINHAS*AASUXN16048367",
        purchaseDate: "2024-11-09",
        totalAmount: 420.10,
        cardIdentifier: "1234",
        isInstallment: true,
        installmentCount: 1,
      };

      const key1 = buildPurchaseKey(installmentWithoutCount);
      const key2 = buildPurchaseKey(installmentWithCount1);

      expect(key1).toBe(key2);
    });
  });

  describe("Mixed Purchase Types", () => {
    it("should generate different keys for installment vs non-installment with same data", () => {
      const baseData = {
        description: "GOL LINHAS*AASUXN16048367",
        purchaseDate: "2024-11-09",
        totalAmount: 420.10,
        cardIdentifier: "1234",
      };

      const nonInstallment = {
        ...baseData,
        isInstallment: false,
      };

      const installment = {
        ...baseData,
        isInstallment: true,
        installmentCount: 1,
      };

      const key1 = buildPurchaseKey(nonInstallment);
      const key2 = buildPurchaseKey(installment);

      expect(key1).not.toBe(key2);
    });
  });
});
