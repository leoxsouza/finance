import { describe, it, expect, beforeEach, vi } from "vitest";
import { PATCH } from "../route";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/auth/api", () => ({
  ensureApiAuthenticated: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db", () => ({
  default: {
    envelope: {
      findUnique: vi.fn(),
    },
    transaction: {
      update: vi.fn(),
    },
  },
}));

describe("PATCH /api/transactions", () => {
  let mockRequest: NextRequest;
  let mockPrisma: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    mockPrisma = await import("@/lib/db").then(m => m.default);
    
    mockRequest = new NextRequest("http://localhost:3000/api/transactions?id=1", {
      method: "PATCH",
      body: JSON.stringify({ description: "Updated description" }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("updates a transaction successfully", async () => {
    const updatedTransaction = {
      id: 1,
      date: new Date("2023-01-01"),
      description: "Updated description",
      value: 100,
      type: "OUT",
      envelopeId: 1,
      Envelope: { name: "Test Envelope" },
    };

    mockPrisma.envelope.findUnique.mockResolvedValue({ id: 1, name: "Test Envelope" });
    mockPrisma.transaction.update.mockResolvedValue(updatedTransaction);

    const response = await PATCH(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: 1,
      date: "2023-01-01T00:00:00.000Z",
      description: "Updated description",
      value: 100,
      type: "OUT",
      envelopeId: 1,
      envelopeName: "Test Envelope",
    });

    expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Updated description",
      },
      include: { Envelope: true },
    });
  });

  it("validates transaction ID", async () => {
    const invalidRequest = new NextRequest("http://localhost:3000/api/transactions?id=invalid", {
      method: "PATCH",
      body: JSON.stringify({ description: "Updated description" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await PATCH(invalidRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("validates at least one field is provided", async () => {
    const emptyRequest = new NextRequest("http://localhost:3000/api/transactions?id=1", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await PATCH(emptyRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("validates envelope exists when provided", async () => {
    mockPrisma.envelope.findUnique.mockResolvedValue(null);

    const requestWithEnvelope = new NextRequest("http://localhost:3000/api/transactions?id=1", {
      method: "PATCH",
      body: JSON.stringify({ envelopeId: 999 }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await PATCH(requestWithEnvelope);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Envelope not found");
  });

  it("validates envelope is required for expenses", async () => {
    const requestWithType = new NextRequest("http://localhost:3000/api/transactions?id=1", {
      method: "PATCH",
      body: JSON.stringify({ type: "OUT" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await PATCH(requestWithType);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("handles transaction not found", async () => {
    mockPrisma.envelope.findUnique.mockResolvedValue({ id: 1, name: "Test Envelope" });
    mockPrisma.transaction.update.mockRejectedValue(new Error("Record to update does not exist"));

    const response = await PATCH(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Transaction not found");
  });
});
