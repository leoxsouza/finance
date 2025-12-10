import prisma from "@/lib/db";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type EnvelopeLimit = {
  id: number;
  name: string;
  percentage: number;
  limit: number;
};

export type EnvelopeUsage = Record<number, number>;

export type DashboardEnvelope = EnvelopeLimit & {
  used: number;
  remaining: number;
  percentageUsed: number;
};

export type DashboardResponse = {
  month: string;
  income: number;
  envelopes: DashboardEnvelope[];
  totalSpent: number;
  totalRemaining: number;
};

function assertNumber(value: number, message: string) {
  if (!Number.isFinite(value)) {
    throw new Error(message);
  }
}

function assertPercentage(value: number) {
  if (value < 0 || value > 1) {
    throw new Error("Envelope percentage must be between 0 and 1");
  }
}

function getMonthRange(month: string) {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error("Month must match YYYY-MM format");
  }

  const [year, monthStr] = month.split("-");
  const monthIndex = Number(monthStr) - 1;
  const yearNum = Number(year);

  const start = new Date(Date.UTC(yearNum, monthIndex, 1));
  const end = new Date(Date.UTC(yearNum, monthIndex + 1, 1));

  return { start, end };
}

type EnvelopeInput = {
  id: number;
  name: string;
  percentage: number;
};

type TransactionInput = {
  envelopeId: number | null;
  type: string;
  value: number;
};

function calculateEnvelopeLimits(
  income: number,
  envelopes: EnvelopeInput[],
): EnvelopeLimit[] {
  assertNumber(income, "Income must be a valid number");
  if (income < 0) {
    throw new Error("Income cannot be negative");
  }

  return envelopes.map((envelope) => {
    assertPercentage(envelope.percentage);
    return {
      ...envelope,
      limit: Number((income * envelope.percentage).toFixed(2)),
    };
  });
}

function calculateEnvelopeUsage(transactions: TransactionInput[]): EnvelopeUsage {
  return transactions.reduce<EnvelopeUsage>((usage, trx) => {
    if (trx.value < 0) {
      throw new Error("Transaction value cannot be negative");
    }

    if (trx.type === "OUT" && typeof trx.envelopeId === "number") {
      usage[trx.envelopeId] = Number(
        ((usage[trx.envelopeId] ?? 0) + trx.value).toFixed(2),
      );
    }

    return usage;
  }, {});
}

async function buildDashboard(month: string): Promise<DashboardResponse> {
  const safeMonth = month || getCurrentMonth();
  const { start, end } = getMonthRange(safeMonth);

  const [budget, envelopes, transactions] = await Promise.all([
    prisma.monthlyBudget.findUnique({ where: { month: safeMonth } }),
    prisma.envelope.findMany({ orderBy: { id: "asc" } }),
    prisma.transaction.findMany({
      where: {
        date: {
          gte: start,
          lt: end,
        },
      },
    }),
  ]);

  if (!budget) {
    throw new Error("Monthly budget not found for requested month");
  }

  type TransactionRecord = (typeof transactions)[number];

  let recordedIncome = 0;
  transactions.forEach((transaction: TransactionRecord) => {
    if (transaction.type === "IN") {
      recordedIncome += transaction.value;
    }
  });
  const normalizedIncome = Number(recordedIncome.toFixed(2));
  const effectiveIncome =
    normalizedIncome > 0 ? normalizedIncome : budget.income;

  const envelopeLimits = calculateEnvelopeLimits(effectiveIncome, envelopes);
  const envelopeUsages = calculateEnvelopeUsage(transactions);

  const enrichedEnvelopes: DashboardEnvelope[] = envelopeLimits.map(
    (limit) => {
      const used = envelopeUsages[limit.id] ?? 0;
      const remaining = Number((limit.limit - used).toFixed(2));
      const percentageUsed = limit.limit === 0 ? 0 : used / limit.limit;

      return {
        ...limit,
        used,
        remaining,
        percentageUsed: Number(percentageUsed.toFixed(4)),
      };
    },
  );

  const totalSpent = enrichedEnvelopes.reduce(
    (sum, env) => sum + env.used,
    0,
  );
  const totalRemaining = Number(
    Math.max(effectiveIncome - totalSpent, 0).toFixed(2),
  );

  return {
    month: safeMonth,
    income: effectiveIncome,
    envelopes: enrichedEnvelopes,
    totalSpent: Number(totalSpent.toFixed(2)),
    totalRemaining,
  };
}

function getCurrentMonth() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const finance = {
  calculateEnvelopeLimits,
  calculateEnvelopeUsage,
  buildDashboard,
  getCurrentMonth,
  getMonthRange,
};

export default finance;
