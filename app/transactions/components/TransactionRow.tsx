"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { EditableTextCell } from "@/components/transactions/EditableTextCell";
import { EditableSelectCell } from "@/components/transactions/EditableSelectCell";
import { EditableEnvelopeCell } from "@/components/transactions/EditableEnvelopeCell";
import type { EnvelopeOption, TransactionRow as TransactionRowType } from "@/types/transactions";

type TransactionRowProps = {
  transaction: TransactionRowType;
  envelopes: EnvelopeOption[];
  onDelete: (transaction: TransactionRowType) => void;
  onUpdate: (id: number, updates: Partial<TransactionRowType>) => Promise<void>;
  deletingId?: number | null;
};

const transactionTypeOptions = [
  { label: "Income", value: "IN" },
  { label: "Expense", value: "OUT" },
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// Helper to format installment label
function computeInstallmentLabel(transaction: TransactionRowType): string | null {
  if (!transaction.installmentNumber && !transaction.installmentCount) {
    return null;
  }
  const current = transaction.installmentNumber ?? "?";
  const total = transaction.installmentCount ?? "?";
  return `Parcela ${current}/${total}`;
}

export function TransactionRow({
  transaction,
  envelopes,
  onDelete,
  onUpdate,
  deletingId,
}: TransactionRowProps) {
  const [updatingFields, setUpdatingFields] = useState<Set<string>>(new Set());

  const handleFieldUpdate = async (field: string, value: string | number | null) => {
    const updateKey = `${transaction.id}-${field}`;
    
    // Optimistic update - update local state immediately
    setUpdatingFields(prev => new Set(prev).add(updateKey));

    try {
      // Prepare update payload
      const updates: Partial<TransactionRowType> = {};
      
      switch (field) {
        case "date":
          if (typeof value === "string") {
            updates.date = value;
          }
          break;
        case "description":
          if (typeof value === "string") {
            updates.description = value.trim();
          }
          break;
        case "value":
          const numValue = Number(value);
          if (!Number.isFinite(numValue) || numValue <= 0) {
            throw new Error("Value must be greater than zero");
          }
          updates.value = numValue;
          break;
        case "type":
          updates.type = value as "IN" | "OUT";
          // If changing to IN, clear envelope
          if (value === "IN") {
            updates.envelopeId = null;
          }
          break;
        case "envelopeId":
          if (value === null || typeof value === "number") {
            updates.envelopeId = value;
          }
          break;
        default:
          throw new Error(`Unknown field: ${field}`);
      }

      await onUpdate(transaction.id, updates);
      
      toast.success("Transaction updated", {
        description: `${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update transaction";
      toast.error("Update failed", { description: message });
      throw error; // Re-throw to let the editable cell handle the error state
    } finally {
      setUpdatingFields(prev => {
        const next = new Set(prev);
        next.delete(updateKey);
        return next;
      });
    }
  };

  const validateField = (field: string, value: string | number | null): string | null => {
    switch (field) {
      case "date":
        if (!value) return "Date is required";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Invalid date";
        return null;
      case "description":
        if (!value || (typeof value === "string" && !value.trim())) return "Description is required";
        if (typeof value === "string" && value.trim().length > 255) return "Description too long";
        return null;
      case "value":
        const numValue = Number(value);
        if (!Number.isFinite(numValue)) return "Invalid number";
        if (numValue <= 0) return "Value must be greater than zero";
        return null;
      case "envelopeId":
        if (transaction.type === "OUT" && !value) {
          return "Envelope is required for expenses";
        }
        return null;
      default:
        return null;
    }
  };

  const isFieldUpdating = (field: string) => {
    return updatingFields.has(`${transaction.id}-${field}`);
  };

  return (
    <TableRow>
      <TableCell>
        <EditableTextCell
          value={transaction.date}
          onSave={(value) => handleFieldUpdate("date", value)}
          type="date"
          validate={(value) => validateField("date", value)}
          disabled={isFieldUpdating("date")}
          formatDisplay={(value) => dateFormatter.format(new Date(value))}
        />
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <EditableTextCell
            value={transaction.description}
            onSave={(value) => handleFieldUpdate("description", value)}
            type="text"
            placeholder="Add description..."
            disabled={isFieldUpdating("description")}
            validate={(value) => validateField("description", value)}
          />
          <p className="text-xs text-slate-500">#{transaction.id}</p>
          {(() => {
            const installmentLabel = computeInstallmentLabel(transaction);
            return installmentLabel && (
              <p className="text-xs font-medium text-indigo-600">
                {installmentLabel}
              </p>
            );
          })()}
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold text-slate-900">
        <EditableTextCell
          value={transaction.value.toString()}
          onSave={(value) => handleFieldUpdate("value", value)}
          type="number"
          placeholder="0.00"
          disabled={isFieldUpdating("value")}
          validate={(value) => validateField("value", value)}
          formatDisplay={(value) => currencyFormatter.format(Number(value))}
          displayClassName="text-right"
        />
      </TableCell>
      <TableCell>
        <div className={transaction.type === "IN" ? "text-emerald-600" : "text-rose-600"}>
          <EditableSelectCell
            value={transaction.type}
            options={transactionTypeOptions}
            onSave={(value) => handleFieldUpdate("type", value)}
            disabled={isFieldUpdating("type")}
            formatDisplay={(value) => value === "IN" ? "Income" : "Expense"}
          />
        </div>
      </TableCell>
      <TableCell>
        <EditableEnvelopeCell
          value={transaction.envelopeId}
          envelopes={envelopes}
          onSave={(value) => handleFieldUpdate("envelopeId", value)}
          disabled={isFieldUpdating("envelopeId") || transaction.type === "IN"}
          transactionType={transaction.type}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => onDelete(transaction)}
          disabled={deletingId === transaction.id}
        >
          {deletingId === transaction.id ? "Deleting..." : "Delete"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
