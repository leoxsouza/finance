import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import Progress from "@/components/ui/progress";
import finance from "@/lib/finance";
import type { DashboardEnvelope } from "@/lib/finance";

import DashboardChart from "./DashboardChart";

export const metadata: Metadata = {
  title: "Dashboard",
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type DashboardPageProps = {
  searchParams?: {
    month?: string;
  };
};

async function DashboardPage({ searchParams }: DashboardPageProps) {
  const rawMonth = typeof searchParams?.month === "string" ? searchParams.month : undefined;
  const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
  const month = rawMonth && monthPattern.test(rawMonth) ? rawMonth : finance.getCurrentMonth();

  const dashboard = await finance.buildDashboard(month);
  const averageUsage =
    dashboard.envelopes.length === 0
      ? 0
      : dashboard.envelopes.reduce((sum, env) => sum + env.percentageUsed, 0) / dashboard.envelopes.length;

  const stats = [
    { label: "Income", value: formatCurrency(dashboard.income) },
    { label: "Spent", value: formatCurrency(dashboard.totalSpent) },
    { label: "Remaining", value: formatCurrency(dashboard.totalRemaining) },
  ];

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-2 pb-12 sm:px-0">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
          <h1 className="text-3xl font-semibold text-slate-900">Envelope health overview</h1>
          <p className="max-w-2xl text-base text-slate-600">
            Compare how each envelope is performing this month, monitor your spending against limits, and
            visualize the distribution of expenses to stay on target.
          </p>
        </div>
        <form className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="month">
            Month
          </label>
          <div className="flex items-center gap-3">
            <Input type="month" id="month" name="month" defaultValue={dashboard.month} className="w-40" />
            <Button type="submit" variant="secondary">
              Update
            </Button>
          </div>
        </form>
      </header>

      <Card>
        <CardHeader className="flex flex-col gap-2 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl">Summary for {dashboard.month}</CardTitle>
            <CardDescription>Income allocation vs. actual spending this month.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
                <p className="text-lg font-semibold text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>
              Total envelopes: <strong>{dashboard.envelopes.length}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Average usage: <strong>{formatPercentage(averageUsage)}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <Link href="/setup" className="text-emerald-600 transition hover:text-emerald-700">
              Adjust envelopes
            </Link>
          </div>
          <DashboardChart envelopes={dashboard.envelopes} />
        </CardContent>
      </Card>

      <EnvelopeGrid envelopes={dashboard.envelopes} />
    </section>
  );
}

function formatPercentage(value: number) {
  return value.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 0 });
}

function EnvelopeGrid({ envelopes }: { envelopes: DashboardEnvelope[] }) {
  if (envelopes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-slate-500">
          No envelopes configured yet. Visit the setup page to define your categories.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {envelopes.map((envelope) => (
        <EnvelopeCard key={envelope.id} envelope={envelope} />
      ))}
    </div>
  );
}

function EnvelopeCard({ envelope }: { envelope: DashboardEnvelope }) {
  const percent = Math.min(envelope.percentageUsed * 100, 999);
  const statusClass =
    percent >= 100 ? "text-sm font-semibold text-rose-600" : "text-sm font-semibold text-emerald-600";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1 border-b border-slate-100">
        <CardTitle className="flex items-center justify-between text-lg">
          {envelope.name}
          <span className={statusClass}>{percent.toFixed(0)}%</span>
        </CardTitle>
        <CardDescription>{formatCurrency(envelope.limit)} limit</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <Progress value={percent} max={100} className="h-2 w-full overflow-hidden rounded-full bg-slate-100" />
        <dl className="grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Used</dt>
            <dd className="font-semibold text-slate-900">{formatCurrency(envelope.used)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Remaining</dt>
            <dd className="font-semibold text-slate-900">{formatCurrency(envelope.remaining)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Allocation</dt>
            <dd className="font-semibold text-slate-900">{formatPercentage(envelope.percentage)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export default DashboardPage;
