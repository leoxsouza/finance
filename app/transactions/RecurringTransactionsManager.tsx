"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { RecurringTransactionRow } from "@/types/transactions";

type RecurringTransactionsManagerProps = {
  onTransactionUpdated?: () => void;
};

export default function RecurringTransactionsManager({ 
  onTransactionUpdated 
}: RecurringTransactionsManagerProps) {
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RecurringTransactionRow | null>(null);

  useEffect(() => {
    fetchRecurringTransactions();
  }, []);

  const fetchRecurringTransactions = async () => {
    try {
      const response = await fetch("/api/recurring-transactions");
      if (response.ok) {
        const data = await response.json();
        setRecurringTransactions(data.items);
      }
    } catch {
      toast.error("Unable to load recurring transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRecurring = async (transaction: RecurringTransactionRow) => {
    try {
      const response = await fetch(`/api/recurring-transactions/${transaction.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRecurringTransactions(prev => 
          prev.filter(t => t.id !== transaction.id)
        );
        toast.success("Recurring transaction cancelled");
        onTransactionUpdated?.();
      } else {
        throw new Error("Unable to cancel recurring transaction");
      }
    } catch {
      toast.error("Unable to cancel recurring transaction");
    }
  };

  const openDeleteDialog = (transaction: RecurringTransactionRow) => {
    setPendingDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setPendingDelete(null);
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Loading recurring transactions...</div>;
  }

  if (recurringTransactions.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No recurring transactions set up.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-slate-900">Recurring Transactions</h3>
      
      <div className="space-y-3">
        {recurringTransactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-slate-900">{transaction.baseDescription}</h4>
                <Badge variant={transaction.type === "IN" ? "success" : "error"}>
                  {transaction.type === "IN" ? "Income" : "Expense"}
                </Badge>
                {transaction.isActive && (
                  <Badge variant="success" className="text-green-600">
                    Active
                  </Badge>
                )}
              </div>
              
              <div className="mt-1 text-sm text-slate-600">
                <span className="font-medium">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(transaction.value)}
                </span>
                {transaction.envelopeName && (
                  <span className="ml-2">• {transaction.envelopeName}</span>
                )}
              </div>
              
              <div className="mt-1 text-xs text-slate-500">
                Repeats on day {transaction.dayOfMonth} of each month
                <span> • indefinitely</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openDeleteDialog(transaction)}
                className="text-red-600 hover:text-red-700"
              >
                Cancel
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel recurring transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop future transactions from being generated, but existing transactions will remain.
              {pendingDelete && (
                <span className="block mt-2 font-medium">
                  &ldquo;{pendingDelete.baseDescription}&rdquo; - {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(pendingDelete.value)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep active</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  handleCancelRecurring(pendingDelete);
                  closeDeleteDialog();
                }
              }}
              className="bg-red-600 hover:bg-red-500"
            >
              Cancel recurrence
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
