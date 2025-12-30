"use client";

import { useState, useCallback } from "react";
import type { TransactionRow, TransactionsListResponse } from "@/types/transactions";

interface UseEnvelopeTransactionsProps {
  envelopeId: number;
  month: string;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export function useEnvelopeTransactions({ envelopeId, month }: UseEnvelopeTransactionsProps) {
  const [items, setItems] = useState<TransactionRow[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/envelopes/${envelopeId}/transactions?month=${month}&page=${page}&pageSize=${pagination.pageSize}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch transactions");
      }

      const data: TransactionsListResponse = await response.json();
      setItems(data.items);
      setPagination({
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [envelopeId, month, pagination.pageSize]);

  const fetchPage = useCallback((page: number) => {
    fetchTransactions(page);
  }, [fetchTransactions]);

  const refresh = useCallback(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  return {
    items,
    pagination,
    loading,
    error,
    fetchPage,
    refresh,
  };
}
