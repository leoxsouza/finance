import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/serverSession";
import prisma from "@/lib/db";
import finance from "@/lib/finance";

import EnvelopeSetupForm from "./EnvelopeSetupForm";

type EnvelopeDTO = {
  id: number;
  name: string;
  percentage: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function SetupPage() {
  await requireSession();
  const month = finance.getCurrentMonth();
  const { start, end } = finance.getMonthRange(month);
  const [envelopes, incomeAggregate] = await Promise.all([
    prisma.envelope.findMany({ orderBy: { id: "asc" } }),
    prisma.transaction.aggregate({
      where: {
        type: "IN",
        date: {
          gte: start,
          lt: end,
        },
      },
      _sum: { value: true },
    }),
  ]);

  const serializableEnvelopes: EnvelopeDTO[] = envelopes.map((envelope) => ({
    id: envelope.id,
    name: envelope.name,
    percentage: envelope.percentage,
  }));

  const envelopeCount = serializableEnvelopes.length;
  const rawIncome = Number(incomeAggregate._sum.value?.toFixed(2) ?? 0);
  const totalPercentage = serializableEnvelopes.reduce((sum, envelope) => sum + envelope.percentage, 0);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-2 pb-12 sm:px-0">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Setup</p>
          <CardTitle className="text-3xl text-slate-900">Configure envelopes</CardTitle>
          <CardDescription className="text-base leading-relaxed text-slate-600">
            Keep your budgeting envelopes balanced at 100%. Adjust percentages, add new categories, or remove the ones
            you no longer need—everything stays in sync with the envelopes API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 shadow-inner">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Current month</dt>
              <dd className="text-lg font-semibold text-slate-900">{month}</dd>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 shadow-inner">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Income</dt>
              <dd className="text-lg font-semibold text-slate-900">
                {rawIncome > 0 ? formatCurrency(rawIncome) : "No income recorded"}
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 shadow-inner">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Envelopes</dt>
              <dd className="text-lg font-semibold text-slate-900">{envelopeCount}</dd>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 shadow-inner">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Total allocation</dt>
              <dd className="text-lg font-semibold text-slate-900">
                {(totalPercentage * 100).toFixed(0)}
                %
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <EnvelopeSetupForm initialEnvelopes={serializableEnvelopes} />
    </section>
  );
}

export default SetupPage;
