"use client";

import { useMemo } from "react";
import type { DashboardEnvelope } from "@/lib/finance";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DashboardChartProps = {
  envelopes: DashboardEnvelope[];
};

const palette = ["#0ea5e9", "#22c55e", "#f97316", "#6366f1", "#ec4899", "#14b8a6", "#f59e0b"];

const formatValue = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function DashboardChart({ envelopes }: DashboardChartProps) {
  const data = useMemo(
    () =>
      envelopes.map((envelope) => ({
        name: envelope.name,
        value: Number(envelope.used.toFixed(2)),
      })),
    [envelopes],
  );

  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No expenses registered this month.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
        <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(value) => formatValue(value as number)}
          tick={{ fill: "#475569", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
          formatter={(value: number) => formatValue(value)}
          itemStyle={{ color: "#0f172a" }}
          contentStyle={{ borderRadius: "12px", borderColor: "#e2e8f0" }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default DashboardChart;
