"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ProgressProps = React.ProgressHTMLAttributes<HTMLProgressElement> & {
  value: number;
  max?: number;
};

const Progress = React.forwardRef<HTMLProgressElement, ProgressProps>(
  ({ value, max = 100, className, ...props }, ref) => (
    <progress
      ref={ref}
      value={Math.max(0, Math.min(value, max))}
      max={max}
      className={cn("progress-root", className)}
      {...props}
    />
  ),
);

Progress.displayName = "Progress";

export default Progress;
