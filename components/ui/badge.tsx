"use client";

import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "neutral" | "success" | "warning" | "error";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  success: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  warning: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200",
  error: "bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-200",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", VARIANT_STYLES[variant], className)} {...props} />;
}

export default Badge;
