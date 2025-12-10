import prisma from "@/lib/db";
import finance from "@/lib/finance";

import TransactionsPageClient from "./TransactionsPageClient";
import type { EnvelopeOption, TransactionRow } from "./types";

async function getInitialData() {
  const month = finance.getCurrentMonth();
  const { start, end } = finance.getMonthRange(month);

  const [envelopes, transactions] = await Promise.all([
    prisma.envelope.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({
      where: {
        date: {
          gte: start,
          lt: end,
        },
      },
      include: {
        Envelope: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 25,
    }),
  ]);

  const safeEnvelopes = envelopes.map<EnvelopeOption>((envelope) => ({
    id: envelope.id,
    name: envelope.name,
  }));

  const safeTransactions = transactions.map<TransactionRow>((transaction) => ({
    id: transaction.id,
    date: transaction.date.toISOString(),
    description: transaction.description,
    value: transaction.value,
    type: transaction.type === "IN" ? "IN" : "OUT",
    envelopeId: transaction.envelopeId,
    envelopeName: transaction.Envelope?.name ?? null,
  }));

  return {
    defaultMonth: month,
    envelopes: safeEnvelopes,
    transactions: safeTransactions,
  };
}

async function TransactionsPage() {
  const { defaultMonth, envelopes, transactions } = await getInitialData();

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-2 pb-12 sm:px-0">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Transactions</p>
        <h1 className="text-3xl font-semibold text-slate-900">Track income & expenses</h1>
        <p className="text-base text-slate-600">
          Record every movement and keep an eye on how each envelope is behaving. Filter by month, category, or type to
          audit your history quickly.
        </p>
      </header>

      <TransactionsPageClient
        defaultMonth={defaultMonth}
        envelopes={envelopes}
        initialTransactions={transactions}
      />
    </section>
  );
}

export default TransactionsPage;
