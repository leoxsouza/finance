"use client";

import { createContext, useContext, useEffect, useId, useState, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (next: string) => void;
  baseId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function Tabs({ defaultValue, value, onValueChange, children, className, ...props }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? value ?? "");
  const resolvedValue = value ?? internalValue;
  const baseId = useId();

  useEffect(() => {
    if (defaultValue !== undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue]);

  const handleChange = (next: string) => {
    if (!value) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ value: resolvedValue, setValue: handleChange, baseId }}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

type TabsListProps = HTMLAttributes<HTMLDivElement>;

export function TabsList({ className, ...props }: TabsListProps) {
  return <div role="tablist" className={cn("inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 text-sm font-medium", className)} {...props} />;
}

type TabsTriggerProps = {
  value: string;
} & HTMLAttributes<HTMLButtonElement>;

export function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
  const context = useTabsContext();
  const active = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      id={`${context.baseId}-trigger-${value}`}
      aria-controls={`${context.baseId}-content-${value}`}
      className={cn(
        "rounded-full px-4 py-1.5 transition-colors",
        active ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-900",
        className,
      )}
      onClick={() => context.setValue(value)}
      {...props}
    >
      {children}
    </button>
  );
}

type TabsContentProps = {
  value: string;
} & HTMLAttributes<HTMLDivElement>;

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const context = useTabsContext();
  const hidden = context.value !== value;

  return (
    <div
      role="tabpanel"
      id={`${context.baseId}-content-${value}`}
      aria-labelledby={`${context.baseId}-trigger-${value}`}
      hidden={hidden}
      className={cn(hidden ? "hidden" : "block", className)}
      {...props}
    >
      {!hidden ? children : null}
    </div>
  );
}

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within <Tabs>");
  }
  return context;
}
