"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CsvImportPanel from "./components/CsvImportPanel";
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
          setListError(error instanceof Error ? error.message : "Unexpected error while fetching transactions");
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
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Unexpected error while saving transaction");
      }
    });
  };

  const onFormInputChange = (field: keyof TransactionFormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    handleFormChange({ [field]: event.target.value } as Partial<TransactionFormState>);
  };

  const handleDelete = (transaction: TransactionRow) => {
    const confirmed = window.confirm(`Delete transaction #${transaction.id}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setDeletingId(transaction.id);

    fetch(`/api/transactions?id=${transaction.id}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((payload) => {
            throw new Error(payload.error ?? "Unable to delete transaction");
          });
        }
        refreshTransactions(filters);
      })
      .catch((error) => {
        setDeleteError(error instanceof Error ? error.message : "Unexpected error while deleting transaction");
      })
      .finally(() => setDeletingId((current) => (current === transaction.id ? null : current)));
  };

  return (
    <div className="space-y-8">
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
          </div>
        </form>
      </section>

      <CsvImportPanel onImportComplete={() => refreshTransactions(filters)} />

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Filters</p>
            <p className="text-sm text-slate-600">Refine the list by month, type, or envelope.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input type="month" value={filters.month} onChange={(event) => handleFilterChange({ month: event.target.value })} />
            <Select
              options={typeFilterOptions}
              value={filters.type}
              onChange={(event) => handleFilterChange({ type: event.target.value as FiltersState["type"] })}
            />
            <Select
              options={envelopeFilterOptions}
              value={filters.envelopeId}
              onChange={(event) => handleFilterChange({ envelopeId: event.target.value })}
            />
          </div>
        </div>

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
                      onClick={() => handleDelete(transaction)}
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
      </section>
    </div>
  );
}

export default TransactionsPageClient;
