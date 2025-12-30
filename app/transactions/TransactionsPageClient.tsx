"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { PaginationControls } from "@/components/ui/pagination";
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
  SortableTableHead,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/usePagination";
import {
  DEFAULT_TRANSACTIONS_PAGE,
  DEFAULT_TRANSACTIONS_PAGE_SIZE,
  TRANSACTION_PAGE_SIZE_OPTIONS,
} from "@/lib/transactions/constants";
import CsvImportButton from "./components/CsvImportButton";
import { TransactionRow as TransactionRowComponent } from "./components/TransactionRow";
import RecurringTransactionsManager from "./RecurringTransactionsManager";
import type { 
  EnvelopeOption, 
  TransactionRow, 
  TransactionsFilters, 
  TransactionsListResponse, 
  SortState, 
  SortField, 
  SortOrder 
} from "@/types/transactions";

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
};

type TransactionsPageClientProps = {
  defaultMonth: string;
  envelopes: EnvelopeOption[];
  initialTransactions: TransactionRow[];
  initialFilters: TransactionsFilters;
  initialPagination: PaginationState;
  initialSortState?: SortState;
};

type TransactionFormState = {
  date: string;
  description: string;
  value: string;
  type: "IN" | "OUT";
  envelopeId: string;
  isRecurring: boolean;
  endDate: string;
};

type FiltersState = TransactionsFilters;

const transactionTypeOptions = [
  { label: "Income", value: "IN" },
  { label: "Expense", value: "OUT" },
];

const typeFilterOptions = [{ label: "All types", value: "" }, ...transactionTypeOptions];

const installmentFilterOptions = [
  { label: "All transactions", value: "" },
  { label: "Installments only", value: "INSTALLMENT" },
  { label: "Non-installments only", value: "NON_INSTALLMENT" },
];

const DEFAULT_SORT_STATE: SortState = {
  sortBy: "date",
  sortOrder: "desc",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
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
    isRecurring: false,
    endDate: "",
  };
};

function TransactionsPageClient({
  defaultMonth,
  envelopes,
  initialTransactions,
  initialFilters,
  initialPagination,
  initialSortState,
}: TransactionsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState<TransactionFormState>(() => createInitialFormState(defaultMonth, envelopes));
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [transactions, setTransactions] = useState<TransactionRow[]>(initialTransactions);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionPendingDelete, setTransactionPendingDelete] = useState<TransactionRow | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [paginationState, setPaginationState] = useState<PaginationState>(initialPagination);
  const [sortState, setSortState] = useState<SortState>(initialSortState || DEFAULT_SORT_STATE);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const pageSizeOptions = useMemo(() => Array.from(TRANSACTION_PAGE_SIZE_OPTIONS), []);

  const envelopeFilterOptions = useMemo(
    () => [{ label: "All envelopes", value: "" }, ...envelopes.map((env) => ({ label: env.name, value: env.id.toString() }))],
    [envelopes],
  );

  const envelopeFormOptions = useMemo(
    () => envelopes.map((env) => ({ label: env.name, value: env.id.toString() })),
    [envelopes],
  );

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

  const buildSearchParams = useCallback(
    (targetFilters: FiltersState, pageValue: number, pageSizeValue: number, currentSortState: SortState) => {
      const params = new URLSearchParams();
      params.set("month", targetFilters.month);
      if (targetFilters.type) params.set("type", targetFilters.type);
      if (targetFilters.envelopeId) params.set("envelopeId", targetFilters.envelopeId);
      if (targetFilters.installment) params.set("installment", targetFilters.installment);
      params.set("page", pageValue.toString());
      params.set("pageSize", pageSizeValue.toString());
      params.set("sortBy", currentSortState.sortBy);
      params.set("sortOrder", currentSortState.sortOrder);
      return params;
    },
    [],
  );

  const fetchTransactions = useCallback(
    async (nextFilters: FiltersState, pageValue: number, pageSizeValue: number, currentSortState?: SortState) => {
      const params = buildSearchParams(nextFilters, pageValue, pageSizeValue, currentSortState || sortState);
      const response = await fetch(`/api/transactions?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to fetch transactions");
      }

      const data = (await response.json()) as TransactionsListResponse;
      setTransactions(data.items);
      setPaginationState({
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
      });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return data;
    },
    [buildSearchParams, pathname, router, sortState],
  );

  const refreshTransactions = useCallback(
    (nextFilters: FiltersState, paginationOverride?: Partial<PaginationState>) => {
      const targetPage = paginationOverride?.page ?? paginationState.page ?? DEFAULT_TRANSACTIONS_PAGE;
      const targetPageSize = paginationOverride?.pageSize ?? paginationState.pageSize ?? DEFAULT_TRANSACTIONS_PAGE_SIZE;

      startRefreshTransition(async () => {
        try {
          setListError(null);
          let data = await fetchTransactions(nextFilters, targetPage, targetPageSize);
          if (data.items.length === 0 && data.total > 0 && data.page > 1) {
            data = await fetchTransactions(nextFilters, data.page - 1, data.pageSize);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected error while fetching transactions";
          setListError(message);
          toast.error("Unable to refresh transactions", { description: message });
        }
      });
    },
    [fetchTransactions, paginationState.page, paginationState.pageSize, startRefreshTransition],
  );

  const pagination = usePagination({
    totalItems: paginationState.total,
    initialPage: initialPagination.page,
    initialPageSize: initialPagination.pageSize,
    pageSizeOptions,
    onChange: (next) => {
      refreshTransactions(filters, next);
    },
    isPending: isRefreshing,
  });

  const handleFilterChange = (partial: Partial<FiltersState>) => {
    const nextFilters = { ...filters, ...partial };
    setFilters(nextFilters);
    refreshTransactions(nextFilters, { page: DEFAULT_TRANSACTIONS_PAGE });
  };

  const handleSortChange = useCallback(
    (field: string) => {
      // Validate that the field is a valid SortField
      const validFields: SortField[] = ["date", "description", "value", "type", "envelopeName"];
      if (!validFields.includes(field as SortField)) {
        return; // Invalid field, do nothing
      }

      const sortField = field as SortField;
      const newSortOrder = sortState.sortBy === sortField && sortState.sortOrder === 'asc' ? 'desc' : 'asc';
      const newSortState = { sortBy: sortField, sortOrder: newSortOrder as SortOrder };
      setSortState(newSortState);
      refreshTransactions(filters, { page: DEFAULT_TRANSACTIONS_PAGE });
    },
    [sortState, filters, refreshTransactions]
  );

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
    
    // Existing validations
    if (form.type === "OUT" && !form.envelopeId) {
      setFormError("Envelope is required for expenses");
      return;
    }

    const numericValue = Number(form.value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setFormError("Value must be greater than zero");
      return;
    }

    // Recurring transaction validation
    if (form.isRecurring && form.endDate && form.endDate <= form.date) {
      setFormError("End date must be after the start date");
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
            isRecurring: form.isRecurring,
            endDate: form.isRecurring && form.endDate ? form.endDate : null,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to create transaction");
        }

        const result = await response.json();
        
        resetForm();
        refreshTransactions(filters);
        
        if (result.isRecurring) {
          const message = result.generatedCount > 0 
            ? `Recurring transaction created with ${result.generatedCount} future transactions`
            : "Recurring transaction created";
          toast.success("Recurring transaction created", { 
            description: message
          });
        } else {
          toast.success("Transaction created", { 
            description: "Your transaction was saved successfully." 
          });
        }
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

  const handleUpdate = useCallback(
    async (id: number, updates: Partial<TransactionRow>) => {
      // Optimistic update - update local state immediately
      setTransactions((prev) =>
        prev.map((trx) =>
          trx.id === id ? { ...trx, ...updates } : trx
        )
      );

      try {
        const response = await fetch(`/api/transactions?id=${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to update transaction");
        }

        // Refresh transactions to get the latest data from server
        refreshTransactions(filters);
      } catch (error) {
        // Revert optimistic update on error
        setTransactions((prev) =>
          prev.map((trx) =>
            trx.id === id ? { ...trx } : trx // This will trigger a re-render with original data
          )
        );
        throw error;
      }
    },
    [filters, refreshTransactions]
  );

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

        const currentPageItems = transactions.length;
        const isLastItemOnPage = currentPageItems === 1 && paginationState.page > 1;
        const nextPage = isLastItemOnPage ? paginationState.page - 1 : paginationState.page;

        refreshTransactions(filters, { page: nextPage });
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

          {/* Recurring Transaction Options */}
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isRecurring"
                checked={form.isRecurring}
                onChange={(e) => handleFormChange({ isRecurring: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isRecurring" className="text-sm font-medium text-slate-700">
                Make this a recurring transaction
              </label>
            </div>

            {form.isRecurring && (
              <div className="space-y-2 pl-6">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    End Date (optional)
                  </label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={onFormInputChange("endDate")}
                    min={form.date}
                    placeholder="No end date"
                  />
                  <p className="text-xs text-slate-500">
                    Transaction will repeat monthly on the {new Date(form.date).getDate()}th day. 
                    Leave end date empty for indefinite recurrence.
                  </p>
                </div>
              </div>
            )}
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
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Installments</label>
              <Select
                options={installmentFilterOptions}
                value={filters.installment}
                onChange={(event) => handleFilterChange({ installment: event.target.value as FiltersState["installment"] })}
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
            <SortableTableHead 
              field="date" 
              currentSort={sortState} 
              onSortChange={handleSortChange}
            >
              Date
            </SortableTableHead>
            <SortableTableHead 
              field="description" 
              currentSort={sortState} 
              onSortChange={handleSortChange}
            >
              Description
            </SortableTableHead>
            <SortableTableHead 
              field="value" 
              currentSort={sortState} 
              onSortChange={handleSortChange}
              className="text-right"
            >
              Value
            </SortableTableHead>
            <SortableTableHead 
              field="type" 
              currentSort={sortState} 
              onSortChange={handleSortChange}
            >
              Type
            </SortableTableHead>
            <SortableTableHead 
              field="envelopeName" 
              currentSort={sortState} 
              onSortChange={handleSortChange}
            >
              Envelope
            </SortableTableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
                No transactions found for the selected filters.
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((transaction) => (
              <TransactionRowComponent
                key={transaction.id}
                transaction={transaction}
                envelopes={envelopes}
                onDelete={openDeleteDialog}
                onUpdate={handleUpdate}
                deletingId={deletingId}
              />
            ))
          )}
        </TableBody>
      </Table>

      {paginationState.total > 0 && (
        <div className="mt-4">
          <PaginationControls
            page={pagination.page}
            pageCount={pagination.pageCount}
            pageSize={pagination.pageSize}
            pageSizeOptions={pageSizeOptions}
            totalItems={pagination.total}
            start={pagination.startIndex}
            end={pagination.endIndex}
            onPageChange={pagination.goToPage}
            onPageSizeChange={pagination.setPageSize}
            disabled={isRefreshing}
            pendingPage={pagination.pendingPage}
          />
        </div>
      )}

      {/* Add Recurring Transactions Manager */}
      <section className="mt-8">
        <RecurringTransactionsManager onTransactionUpdated={() => refreshTransactions(filters)} />
      </section>
    </div>
  );
}

export default TransactionsPageClient;
