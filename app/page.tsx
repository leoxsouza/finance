import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Progress from "@/components/ui/progress";
import { requireSession } from "@/lib/auth/serverSession";
import finance from "@/lib/finance";
import { formatCurrency, formatPercentage } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CTA_LINKS = [
  { href: "/setup", label: "Configure envelopes", description: "Distribute income across categories" },
  { href: "/dashboard", label: "View dashboard", description: "Check spending vs. limits" },
  { href: "/transactions", label: "Log transactions", description: "Record income and expenses" },
] as const;

const NEXT_STEPS = [
  {
    title: "Finish setup",
    detail: "Keep envelopes at 100% allocation every month for accurate tracking.",
    href: "/setup",
  },
  {
    title: "Record new expenses",
    detail: "Log purchases as they happen so dashboards stay current.",
    href: "/transactions",
  },
  {
    title: "Audit envelope health",
    detail: "Use the dashboard to find envelopes that are close to their limits.",
    href: "/dashboard",
  },
] as const;

async function HomePage() {
  await requireSession();
  const month = finance.getCurrentMonth();

  let dashboard: Awaited<ReturnType<typeof finance.buildDashboard>> | null = null;
  try {
    dashboard = await finance.buildDashboard(month);
  } catch {
    dashboard = null;
  }

  const stats = dashboard
    ? [
        { label: "Month", value: dashboard.month },
        { label: "Income", value: formatCurrency(dashboard.income) },
        { label: "Spent", value: formatCurrency(dashboard.totalSpent) },
        { label: "Remaining", value: formatCurrency(dashboard.totalRemaining) },
      ]
    : [
        { label: "Month", value: month },
        { label: "Income", value: "Add income" },
        { label: "Spent", value: "—" },
        { label: "Remaining", value: "—" },
      ];

  const envelopeSnapshot = dashboard?.envelopes.slice(0, 4) ?? [];
  const hasData = Boolean(dashboard && dashboard.envelopes.length > 0);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Personal finance manager</p>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold text-slate-900">
              Stay on top of your envelopes with one monthly workflow.
            </h1>
            <p className="text-lg text-slate-600">
              Allocate income, capture every transaction, and watch the dashboard highlight when a category needs
              attention. Start by configuring envelopes, then keep the loop running all month.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {CTA_LINKS.map((cta) => (
              <Link
                key={cta.href}
                href={cta.href}
                className={cn(
                  buttonVariants({
                    variant: cta.href === "/setup" ? "default" : "secondary",
                    size: "lg",
                  }),
                  "shadow-sm",
                )}
                aria-label={cta.description}
              >
                {cta.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="border-none px-5 pb-2 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Next steps</p>
            <CardTitle className="text-2xl">Keep the flow moving</CardTitle>
            <CardDescription>Follow this loop every week to keep real-time visibility.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {NEXT_STEPS.map((step, index) => (
              <Link
                key={step.title}
                href={step.href}
                className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-slate-200 hover:bg-white"
              >
                <span className="text-sm font-semibold text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="text-base font-semibold text-slate-900">{step.title}</p>
                  <p className="text-sm text-slate-600">{step.detail}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Envelope snapshot</p>
            <CardTitle className="text-2xl">Usage highlights</CardTitle>
            <CardDescription>
              {hasData
                ? "Top envelopes this month. Resolve red zones before they exceed 100%."
                : "No envelopes yet. Configure your categories to see usage here."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasData ? (
              envelopeSnapshot.map((envelope) => (
                <article key={envelope.id} className="space-y-1.5 rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                    <span>{envelope.name}</span>
                    <span className={envelope.percentageUsed >= 0.9 ? "text-red-600" : "text-emerald-600"}>
                      {formatPercentage(envelope.percentageUsed, 0)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(envelope.percentageUsed * 100, 120)}
                    max={120}
                    className={cn(
                      "h-2 overflow-hidden rounded-full bg-slate-100",
                      envelope.percentageUsed >= 1 && "progress-danger",
                    )}
                  />
                  <p className="text-sm text-slate-500">
                    {formatCurrency(envelope.used)} of {formatCurrency(envelope.limit)} &middot;{" "}
                    <span className="text-slate-700">{formatCurrency(envelope.remaining)} left</span>
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                <p className="text-base font-semibold text-slate-900">Ready to start?</p>
                <p className="mt-2 text-sm text-slate-600">
                  Configure envelopes and add your first transactions to see live progress bars.
                </p>
                <Link
                  href="/setup"
                  className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-4 inline-flex")}
                >
                  Go to setup
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </section>
  );
}

export default HomePage;
