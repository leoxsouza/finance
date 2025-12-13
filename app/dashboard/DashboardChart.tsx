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
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

type DashboardChartProps = {
  envelopes: DashboardEnvelope[];
};

type ChartDatum = {
  name: string;
  used: number;
  limit: number;
  remaining: number;
  overLimit: boolean;
  usedWithinLimit: number;
  overspend: number;
  limitGap: number;
};

const palette = ["#0ea5e9", "#22c55e", "#f97316", "#6366f1", "#ec4899", "#14b8a6", "#f59e0b"];
const limitStroke = "#f87171";
const overspentColor = "#dc2626";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function DashboardChart({ envelopes }: DashboardChartProps) {
  const data = useMemo<ChartDatum[]>(
    () =>
      envelopes.map((envelope) => {
        const used = Number(envelope.used.toFixed(2));
        const limit = Number(envelope.limit.toFixed(2));
        const overLimit = used > limit;
        const remaining = Number(Math.max(limit - used, 0).toFixed(2));
        const usedWithinLimit = Number(Math.min(used, limit).toFixed(2));
        const overspend = Number(Math.max(used - limit, 0).toFixed(2));
        const limitGap = Number(Math.max(limit - usedWithinLimit, 0).toFixed(2));

        return {
          name: envelope.name,
          used,
          limit,
          remaining,
          overLimit,
          usedWithinLimit,
          overspend,
          limitGap,
        };
      }),
    [envelopes],
  );

  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No expenses registered this month.</p>;
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
          barCategoryGap={24}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#475569", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value as number)}
            tick={{ fill: "#475569", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
            content={<ChartTooltip />}
          />
          <Bar
            dataKey="usedWithinLimit"
            stackId="envelope"
            barSize={26}
            radius={[8, 8, 0, 0]}
          >
            {data.map((datum, index) => (
              <Cell
                key={`cell-used-${datum.name}`}
                fill={palette[index % palette.length]}
              />
            ))}
          </Bar>
          <Bar
            dataKey="limitGap"
            stackId="envelope"
            barSize={26}
            fill="transparent"
            stroke={limitStroke}
            strokeWidth={2}
            strokeDasharray="5 4"
            radius={[10, 10, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="overspend"
            stackId="envelope"
            barSize={26}
            radius={[8, 8, 0, 0]}
            fill={overspentColor}
          />
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend />
    </div>
  );
}

function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
      <LegendMarker variant="solid" label="Uso real" color="#0ea5e9" />
      <LegendMarker variant="outline" label="Limite do envelope" color={limitStroke} />
    </div>
  );
}

type LegendMarkerProps = {
  label: string;
  color: string;
  variant: "solid" | "outline";
};

function LegendMarker({ label, color, variant }: LegendMarkerProps) {
  const baseClasses = "inline-flex h-3 w-3 items-center justify-center rounded";
  const markerClass =
    variant === "solid"
      ? `${baseClasses}`
      : `${baseClasses} border border-[1.5px]`;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={markerClass}
        style={{
          backgroundColor: variant === "solid" ? color : "transparent",
          borderColor: variant === "outline" ? color : "transparent",
          borderStyle: variant === "outline" ? "dashed" : "solid",
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function ChartTooltip({ active, label, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const datum = payload[0].payload as ChartDatum;
  const overLimitAmount = Number(Math.max(datum.used - datum.limit, 0).toFixed(2));
  const remainingLabel = datum.overLimit
    ? `Excedente: ${formatCurrency(overLimitAmount)}`
    : `Disponível: ${formatCurrency(datum.remaining)}`;
  const remainingClass = datum.overLimit ? "text-rose-600" : "text-emerald-600";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <div className="mt-2 space-y-1 text-slate-600">
        <p>
          Uso: <span className="font-semibold text-slate-900">{formatCurrency(datum.used)}</span>
        </p>
        <p>
          Limite: <span className="font-semibold text-slate-900">{formatCurrency(datum.limit)}</span>
        </p>
        <p className={remainingClass}>{remainingLabel}</p>
      </div>
    </div>
  );
}

export default DashboardChart;
