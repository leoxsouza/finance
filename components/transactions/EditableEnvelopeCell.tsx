"use client";

import { cn } from "@/lib/utils";
import { EditableSelectCell } from "./EditableSelectCell";
import type { EnvelopeOption } from "@/types/transactions";

type EditableEnvelopeCellProps = {
  value: number | null;
  envelopes: EnvelopeOption[];
  onSave: (value: number | null) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  displayClassName?: string;
  transactionType?: "IN" | "OUT";
};

export function EditableEnvelopeCell({
  value,
  envelopes,
  onSave,
  disabled = false,
  className,
  displayClassName,
  transactionType,
}: EditableEnvelopeCellProps) {
  // For income transactions, envelope is not applicable
  if (transactionType === "IN") {
    return (
      <span className={cn("text-slate-400", displayClassName)}>
        —
      </span>
    );
  }

  const envelopeOptions = envelopes.map((envelope) => ({
    label: envelope.name,
    value: envelope.id,
  }));

  const formatDisplay = (val: string | number) => {
    const numVal = typeof val === "string" ? (val === "" ? null : Number(val)) : val;
    if (!numVal) return "—";
    const envelope = envelopes.find(env => env.id === numVal);
    return envelope ? envelope.name : "—";
  };

  return (
    <EditableSelectCell
      value={value || ""}
      options={envelopeOptions}
      onSave={(val) => onSave(val === "" ? null : Number(val))}
      placeholder="Select envelope"
      disabled={disabled}
      className={className}
      displayClassName={displayClassName}
      formatDisplay={formatDisplay}
    />
  );
}
