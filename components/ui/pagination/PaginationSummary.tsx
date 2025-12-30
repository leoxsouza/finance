"use client";

import React from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PaginationSummaryProps = {
  label?: ReactNode;
  start: number;
  end: number;
  total: number;
  className?: string;
};

export function PaginationSummary({ label = "Showing", start, end, total, className }: PaginationSummaryProps) {
  if (total === 0) {
    return <p className={cn("text-sm text-slate-500", className)}>No records found.</p>;
  }

  return (
    <p className={cn("text-sm text-slate-600", className)}>
      {label}{" "}
      <span className="font-semibold text-slate-900">
        {start} – {end}
      </span>{" "}
      of <span className="font-semibold text-slate-900">{total}</span>
    </p>
  );
}
