"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Option = {
  label: string;
  value: string | number;
};

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: Option[];
};

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, defaultValue, ...props }, ref) => (
    <select
      ref={ref}
      defaultValue={defaultValue}
      className={cn(
        "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
);

Select.displayName = "Select";

export default Select;
