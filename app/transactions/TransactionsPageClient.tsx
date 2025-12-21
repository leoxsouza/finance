"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CsvImportButton from "./components/CsvImportButton";
import type { EnvelopeOption, TransactionRow } from "./types";

type TransactionsPageClientProps = {
  defaultMonth: string;
  envelopes: EnvelopeOption[];
  initialTransactions: TransactionRow[];
};

type TransactionFormState = {
  date: string;
  description: string;
  value: string;
  type: "IN" | "OUT";
  envelopeId: string;
};

type FiltersState = {
  month: string;
  type: "" | "IN" | "OUT";
  envelopeId: string;
};

const transactionTypeOptions = [
  { label: "Income", value: "IN" },
  { label: "Expense", value: "OUT" },
];

const typeFilterOptions = [{ label: "All types", value: "" }, ...transactionTypeOptions];

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

const createInitialFormState = (defaultMonth: string, envelopes: EnvelopeOption[]): TransactionFormState => {
  const today = new Date();
  const fallbackDate = `${defaultMonth}-01`;
  const bestDate = Number.isNaN(today.getTime()) ? fallbackDate : today.toISOString().slice(0, 10);

  return {
    date: bestDate,
    description: "",
    value: "",
    type: "OUT",
    envelopeId: envelopes[0]?.id.toString() ?? "",
  };
};

function TransactionsPageClient({ defaultMonth, envelopes, initialTransactions }: TransactionsPageClientProps) {
  const [form, setForm] = useState<TransactionFormState>(() => createInitialFormState(defaultMonth, envelopes));
  const [filters, setFilters] = useState<FiltersState>({ month: defaultMonth, type: "", envelopeId: "" });
  const [transactions, setTransactions] = useState<TransactionRow[]>(initialTransactions);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionPendingDelete, setTransactionPendingDelete] = useState<TransactionRow | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();

  const envelopeFilterOptions = useMemo(
    () => [{ label: "All envelopes", value: "" }, ...envelopes.map((env) => ({ label: env.name, value: env.id.toString() }))],
    [envelopes],
  );

  const envelopeFormOptions = useMemo(
    () => envelopes.map((env) => ({ label: env.name, value: env.id.toString() })),
    [envelopes],
  );

  const envelopeLookup = useMemo(() => {
    const map = new Map<number, string>();
    envelopes.forEach((env) => map.set(env.id, env.name));
    return map;
  }, [envelopes]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, trx) => {
        if (trx.type === "IN") {
          acc.income += trx.value;
        } else {
          acc.expense += trx.value;
        }
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [transactions]);

  const balance = totals.income - totals.expense;

  const refreshTransactions = useCallback(
    (nextFilters: FiltersState) => {
      startRefreshTransition(async () => {
        try {
          setListError(null);
          const params = new URLSearchParams();
          if (nextFilters.month) params.set("month", nextFilters.month);
          if (nextFilters.type) params.set("type", nextFilters.type);
          if (nextFilters.envelopeId) params.set("envelopeId", nextFilters.envelopeId);

          const response = await fetch(`/api/transactions?${params.toString()}`, {
            cache: "no-store",
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error ?? "Unable to fetch transactions");
          }

          const data = (await response.json()) as TransactionRow[];
          setTransactions(data);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected error while fetching transactions";
          setListError(message);
          toast.error("Unable to refresh transactions", { description: message });
        }
      });
    },
    [startRefreshTransition],
  );

  const handleFilterChange = (partial: Partial<FiltersState>) => {
    const nextFilters = { ...filters, ...partial };
    setFilters(nextFilters);
    refreshTransactions(nextFilters);
  };

  const shiftMonth = (month: string, deltaMonths: number) => {
    const [yearPart, monthPart] = month.split("-");
    const year = Number(yearPart);
    const monthIndex = Number(monthPart) - 1;

    if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) {
      return month;
    }

    const date = new Date(Date.UTC(year, monthIndex, 1));
    date.setUTCMonth(date.getUTCMonth() + deltaMonths);

    const nextYear = date.getUTCFullYear();
    const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${nextYear}-${nextMonth}`;
  };

  const goToPreviousMonth = () => {
    handleFilterChange({ month: shiftMonth(filters.month, -1) });
  };

  const goToNextMonth = () => {
    handleFilterChange({ month: shiftMonth(filters.month, 1) });
  };

  const handleFormChange = (partial: Partial<TransactionFormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  };

  const resetForm = () => {
    setForm(createInitialFormState(filters.month, envelopes));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.type === "OUT" && !form.envelopeId) {
      setFormError("Envelope is required for expenses");
      return;
    }

    const numericValue = Number(form.value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setFormError("Value must be greater than zero");
      return;
    }

    setFormError(null);

    startSubmitTransition(async () => {
      try {
        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date: form.date,
            description: form.description.trim(),
            value: numericValue,
            type: form.type,
            envelopeId: form.type === "OUT" ? Number(form.envelopeId) : undefined,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to create transaction");
        }

        resetForm();
        refreshTransactions(filters);
        toast.success("Transaction created", { description: "Your transaction was saved successfully." });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error while saving transaction";
        setFormError(message);
        toast.error("Unable to create transaction", { description: message });
      }
    });
  };

  const onFormInputChange = (field: keyof TransactionFormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    handleFormChange({ [field]: event.target.value } as Partial<TransactionFormState>);
  };

  const openDeleteDialog = (transaction: TransactionRow) => {
    setTransactionPendingDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setTransactionPendingDelete(null);
  };

  const handleDelete = (transaction: TransactionRow) => {
    setDeleteError(null);
    setDeletingId(transaction.id);

    void (async () => {
      try {
        const response = await fetch(`/api/transactions?id=${transaction.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to delete transaction");
        }

        refreshTransactions(filters);
        toast.success("Transaction deleted", { description: `Transaction #${transaction.id} was deleted.` });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error while deleting transaction";
        setDeleteError(message);
        toast.error("Unable to delete transaction", { description: message });
      } finally {
        setDeletingId((current) => (current === transaction.id ? null : current));
      }
    })();
  };

  return (
    <div className="space-y-8">
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteDialog();
            return;
          }
          setDeleteDialogOpen(true);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
              {transactionPendingDelete
                ? ` This will permanently delete “${transactionPendingDelete.description}” (#${transactionPendingDelete.id}).`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={transactionPendingDelete === null || deletingId !== null}
              className="bg-red-600 hover:bg-red-500"
              onClick={(event) => {
                event.preventDefault();
                if (!transactionPendingDelete) return;
                handleDelete(transactionPendingDelete);
                closeDeleteDialog();
              }}
            >
              {deletingId !== null ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Date</label>
              <Input type="date" value={form.date} onChange={onFormInputChange("date")} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <Input
                value={form.description}
                onChange={onFormInputChange("description")}
                placeholder="Groceries, Salary..."
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Value</label>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={form.value}
                onChange={onFormInputChange("value")}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Type</label>
              <Select
                options={transactionTypeOptions}
                value={form.type}
                onChange={(event) => {
                  const nextType = event.target.value as "IN" | "OUT";
                  setForm((prev) => ({
                    ...prev,
                    type: nextType,
                    envelopeId:
                      nextType === "IN"
                        ? ""
                        : prev.envelopeId || envelopes[0]?.id.toString() || "",
                  }));
                }}
              />
            </div>
            <div className="space-y-1 md:col-span-2 lg:col-span-1">
              <label className="text-sm font-medium text-slate-700">Envelope</label>
              <Select
                options={envelopeFormOptions}
                value={form.envelopeId}
                onChange={onFormInputChange("envelopeId")}
                disabled={form.type === "IN"}
                required={form.type === "OUT"}
              />
              {form.type === "IN" && <p className="text-xs text-slate-500">Income does not require an envelope.</p>}
            </div>
          </div>

          {formError && <p className="text-sm text-rose-600">{formError}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save transaction"}
            </Button>
            <Button type="button" variant="ghost" disabled={isSubmitting} onClick={resetForm}>
              Clear
            </Button>
            <CsvImportButton
              onImportStart={() => undefined}
              onImportResult={(result) => {
                if (!result.ok) {
                  toast.error("CSV import failed", { description: result.error });
                  return;
                }

                const summary = result.summary;

                if (summary.overwritten) {
                  toast.success("CSV re-imported", {
                    description: "Previous imported transactions for this file were replaced.",
                  });
                }

                const baseMessage = `Created: ${summary.created}. Skipped: ${summary.skipped}.`;
                const message = summary.errors.length > 0 ? `${baseMessage} Errors: ${summary.errors.length}.` : baseMessage;

                toast.success(summary.overwritten ? "CSV re-imported" : "CSV import complete", {
                  description: message,
                });
              }}
              onImportComplete={() => refreshTransactions(filters)}
            />
          </div>
        </form>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Month</label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={goToPreviousMonth} aria-label="Previous month">
                  &lt;
                </Button>
                <Input
                  type="month"
                  value={filters.month}
                  onChange={(event) => handleFilterChange({ month: event.target.value })}
                />
                <Button type="button" variant="ghost" size="sm" onClick={goToNextMonth} aria-label="Next month">
                  &gt;
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Type</label>
              <Select
                options={typeFilterOptions}
                value={filters.type}
                onChange={(event) => handleFilterChange({ type: event.target.value as FiltersState["type"] })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Envelope</label>
              <Select
                options={envelopeFilterOptions}
                value={filters.envelopeId}
                onChange={(event) => handleFilterChange({ envelopeId: event.target.value })}
              />
            </div>
          </div>
        </form>
      </section>

      <div className="flex flex-wrap gap-4 py-4 text-sm text-slate-600">
        <span>
          Income: <strong className="text-emerald-600">{currencyFormatter.format(totals.income)}</strong>
        </span>
        <span>
          Expenses: <strong className="text-rose-600">{currencyFormatter.format(totals.expense)}</strong>
        </span>
        <span>
          Balance: <strong className={balance >= 0 ? "text-emerald-600" : "text-rose-600"}>{currencyFormatter.format(balance)}</strong>
        </span>
        {isRefreshing && <span className="text-xs uppercase tracking-wider text-slate-500">Updating...</span>}
      </div>

      {listError && <p className="text-sm text-rose-600">{listError}</p>}
      {deleteError && <p className="text-sm text-rose-600">{deleteError}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Envelope</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm text-slate-500">
                No transactions found for the selected filters.
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{dateFormatter.format(new Date(transaction.date))}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-slate-900">{transaction.description}</p>
                    <p className="text-xs text-slate-500">#{transaction.id}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-slate-900">
                  {currencyFormatter.format(transaction.value)}
                </TableCell>
                <TableCell>
                  <span className={transaction.type === "IN" ? "text-emerald-600" : "text-rose-600"}>
                    {transaction.type === "IN" ? "Income" : "Expense"}
                  </span>
                </TableCell>
                <TableCell>
                  {transaction.envelopeId
                    ? envelopeLookup.get(transaction.envelopeId) ?? transaction.envelopeName ?? "—"
                    : transaction.envelopeName ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteDialog(transaction)}
                    disabled={deletingId === transaction.id}
                  >
                    {deletingId === transaction.id ? "Deleting..." : "Delete"}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default TransactionsPageClient;
