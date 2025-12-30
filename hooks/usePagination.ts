"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PaginationMeta, PaginationState } from "@/lib/pagination";
import { clampPage, getPaginationMeta } from "@/lib/pagination";

export type UsePaginationOptions = {
  totalItems: number;
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  onChange?: (state: PaginationState) => void;
  isPending?: boolean;
};

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50];

export function usePagination({
  totalItems,
  initialPage = 1,
  initialPageSize = DEFAULT_PAGE_SIZE_OPTIONS[0],
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onChange,
  isPending = false,
}: UsePaginationOptions) {
  const normalizedOptions = useMemo(
    () => (pageSizeOptions.length > 0 ? pageSizeOptions : DEFAULT_PAGE_SIZE_OPTIONS),
    [pageSizeOptions],
  );
  const normalizedInitialPageSize = useMemo(
    () => (normalizedOptions.includes(initialPageSize) ? initialPageSize : normalizedOptions[0]),
    [initialPageSize, normalizedOptions],
  );

  const [page, setPage] = useState(() => Math.max(initialPage, 1));
  const [pageSize, setPageSize] = useState(normalizedInitialPageSize);
  const [pendingPage, setPendingPage] = useState<number | null>(null);

  const state: PaginationState = useMemo(
    () => ({
      page,
      pageSize,
      total: totalItems,
    }),
    [page, pageSize, totalItems],
  );

  const meta: PaginationMeta = useMemo(() => getPaginationMeta(state), [state]);

  useEffect(() => {
    setPage(Math.max(initialPage, 1));
  }, [initialPage]);

  useEffect(() => {
    setPageSize(normalizedInitialPageSize);
  }, [normalizedInitialPageSize]);

  useEffect(() => {
    if (meta.page !== page) {
      setPage(meta.page);
    }
  }, [meta.page, page]);

  useEffect(() => {
    if (!isPending) {
      setPendingPage(null);
    }
  }, [isPending]);

  const applyChange = useCallback(
    (nextState: PaginationState) => {
      setPage(nextState.page);
      setPageSize(nextState.pageSize);
      onChange?.(nextState);
    },
    [onChange],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      const clampedPage = clampPage(nextPage, meta.pageCount || 1);
      if (clampedPage === meta.page) {
        return;
      }
      setPendingPage(clampedPage);
      applyChange({ ...state, page: clampedPage });
    },
    [applyChange, meta.page, meta.pageCount, state],
  );

  const changePageSize = useCallback(
    (nextPageSize: number) => {
      if (nextPageSize === state.pageSize) {
        return;
      }

      const nextState: PaginationState = {
        ...state,
        pageSize: nextPageSize,
        page: 1,
      };
      setPendingPage(1);
      applyChange(nextState);
    },
    [applyChange, state],
  );

  const sliceRange = useCallback((): [number, number] => {
    const startIndex = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize;
    const endIndex = meta.total === 0 ? 0 : Math.min(meta.page * meta.pageSize, meta.total);
    return [startIndex, endIndex];
  }, [meta.page, meta.pageSize, meta.total]);

  return {
    page: meta.page,
    pageSize: meta.pageSize,
    total: meta.total,
    pageCount: meta.pageCount,
    hasNextPage: meta.hasNextPage,
    hasPreviousPage: meta.hasPreviousPage,
    startIndex: meta.startIndex,
    endIndex: meta.endIndex,
    pageSizeOptions: normalizedOptions,
    goToPage,
    nextPage: () => goToPage(meta.page + 1),
    previousPage: () => goToPage(meta.page - 1),
    setPageSize: changePageSize,
    sliceRange,
    pendingPage,
    clearPendingPage: () => setPendingPage(null),
  };
}
