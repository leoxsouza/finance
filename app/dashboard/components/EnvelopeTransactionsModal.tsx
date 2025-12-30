"use client";

import { useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEnvelopeTransactions } from "../hooks/useEnvelopeTransactions";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface EnvelopeTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  envelopeId: number;
  envelopeName: string;
  month: string;
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function EnvelopeTransactionsModal({
  isOpen,
  onClose,
  envelopeId,
  envelopeName,
  month,
}: EnvelopeTransactionsModalProps) {
  const { items, pagination, loading, error, fetchPage } = useEnvelopeTransactions({
    envelopeId,
    month,
  });

  // Fetch first page when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPage(1);
    }
  }, [isOpen, envelopeId, month]); // fetchPage is stable from useCallback

  const monthDate = new Date(month + "-03T00:00:00Z");

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="text-left space-y-1">
            <AlertDialogTitle className="text-2xl font-semibold text-slate-900">
              {envelopeName}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              Transactions for {monthFormatter.format(monthDate)}
            </AlertDialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full hover:bg-slate-100"
          >
            <X className="h-5 w-5 text-slate-500" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-slate-500 text-sm">Loading transactions...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <p className="text-rose-600 text-sm font-medium">{error}</p>
              <Button onClick={() => fetchPage(1)} variant="secondary">
                Try again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-slate-500 font-medium">No transactions found</p>
              <p className="text-slate-400 text-sm">
                There are no expenses recorded for this envelope in this month.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-slate-600 font-medium whitespace-nowrap">
                        {dateFormatter.format(new Date(item.date))}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-medium">
                            {item.description}
                          </span>
                          {item.installmentNumber && (
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                              Installment {item.installmentNumber}/{item.installmentCount}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatCurrency(item.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {pagination.total > pagination.pageSize && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Showing <strong>{items.length}</strong> of <strong>{pagination.total}</strong> transactions
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchPage(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium text-slate-700 w-12 text-center">
                {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchPage(pagination.page + 1)}
                disabled={
                  pagination.page >= Math.ceil(pagination.total / pagination.pageSize) || loading
                }
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
