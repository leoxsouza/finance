import { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { GET } from "../route";
import { ensureApiAuthenticated } from "@/lib/auth/api";
import prisma from "@/lib/db";
import finance from "@/lib/finance";

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
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/finance", () => ({
  default: {
    getCurrentMonth: vi.fn().mockReturnValue("2025-03"),
    getMonthRange: vi.fn().mockReturnValue({
      start: new Date("2025-03-01T00:00:00.000Z"),
      end: new Date("2025-04-01T00:00:00.000Z"),
    }),
  }
}));

const mockPrisma = prisma as unknown as {
  envelope: {
    findUnique: Mocked<typeof prisma.envelope.findUnique>;
  };
  transaction: {
    findMany: Mocked<typeof prisma.transaction.findMany>;
    count: Mocked<typeof prisma.transaction.count>;
  };
};

const mockFinance = vi.mocked(finance);
const mockEnsureApiAuthenticated = vi.mocked(ensureApiAuthenticated);

describe("/api/envelopes/[envelopeId]/transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    mockEnsureApiAuthenticated.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    const request = new NextRequest("http://localhost:3000/api/envelopes/1/transactions");
    const response = await GET(request, { params: { envelopeId: "1" } });

    expect(response.status).toBe(401);
  });

  it("validates envelopeId parameter", async () => {
    const request = new NextRequest("http://localhost:3000/api/envelopes/invalid/transactions");
    const response = await GET(request, { params: { envelopeId: "invalid" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("validates envelope exists", async () => {
    mockPrisma.envelope.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/envelopes/999/transactions");
    const response = await GET(request, { params: { envelopeId: "999" } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Envelope not found");
  });

  it("returns transactions for valid envelope", async () => {
    const mockEnvelope = { id: 1, name: "Food", percentage: 0.3 };
    const mockTransactions = [
      {
        id: 1,
        date: new Date("2025-03-15"),
        description: "Restaurant",
        value: 50.0,
        type: "OUT",
        envelopeId: 1,
        Envelope: { name: "Food" },
        CardPurchase: null,
        createdAt: new Date("2025-03-15T12:00:00.000Z"),
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.envelope.findUnique.mockResolvedValue(mockEnvelope as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions as any);
    mockPrisma.transaction.count.mockResolvedValue(1);

    const request = new NextRequest("http://localhost:3000/api/envelopes/1/transactions");
    const response = await GET(request, { params: { envelopeId: "1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      id: 1,
      date: "2025-03-15T00:00:00.000Z",
      description: "Restaurant",
      value: 50.0,
      type: "OUT",
      envelopeId: 1,
      envelopeName: "Food",
      installmentNumber: null,
      installmentCount: null,
    });
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(25);
  });

  it("filters by month when provided", async () => {
    const mockEnvelope = { id: 1, name: "Food", percentage: 0.3 };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.envelope.findUnique.mockResolvedValue(mockEnvelope as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.transaction.findMany.mockResolvedValue([] as any);
    mockPrisma.transaction.count.mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/envelopes/1/transactions?month=2025-02");
    await GET(request, { params: { envelopeId: "1" } });

    expect(mockFinance.getMonthRange).toHaveBeenCalledWith("2025-02");
  });

  it("applies pagination correctly", async () => {
    const mockEnvelope = { id: 1, name: "Food", percentage: 0.3 };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.envelope.findUnique.mockResolvedValue(mockEnvelope as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.transaction.findMany.mockResolvedValue([] as any);
    mockPrisma.transaction.count.mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/envelopes/1/transactions?page=2&pageSize=10");
    await GET(request, { params: { envelopeId: "1" } });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10, // (page - 1) * pageSize
        take: 10,
      })
    );
  });

  it("validates pageSize limits", async () => {
    const request = new NextRequest("http://localhost:3000/api/envelopes/1/transactions?pageSize=101");
    const response = await GET(request, { params: { envelopeId: "1" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("only returns expense transactions (type OUT)", async () => {
    const mockEnvelope = { id: 1, name: "Food", percentage: 0.3 };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.envelope.findUnique.mockResolvedValue(mockEnvelope as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.transaction.findMany.mockResolvedValue([] as any);
    mockPrisma.transaction.count.mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/envelopes/1/transactions");
    await GET(request, { params: { envelopeId: "1" } });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "OUT",
        }),
      })
    );
  });

  it("orders by date desc, createdAt desc", async () => {
    const mockEnvelope = { id: 1, name: "Food", percentage: 0.3 };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.envelope.findUnique.mockResolvedValue(mockEnvelope as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.transaction.findMany.mockResolvedValue([] as any);
    mockPrisma.transaction.count.mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/envelopes/1/transactions");
    await GET(request, { params: { envelopeId: "1" } });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { date: "desc" },
          { createdAt: "desc" },
        ],
      })
    );
  });
});
