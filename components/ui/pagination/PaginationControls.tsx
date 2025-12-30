"use client";
import React from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import Select from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { PaginationSummary } from "./PaginationSummary";

export type PaginationControlsProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions?: number[];
  totalItems: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
  isCompact?: boolean;
  pendingPage?: number | null;
  summaryLabel?: string;
  className?: string;
};

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50];

export function PaginationControls({
  page,
  pageCount,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  totalItems,
  start,
  end,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  isCompact = false,
  pendingPage = null,
  summaryLabel,
  className,
}: PaginationControlsProps) {
  const hasPrevious = pageCount > 0 && page > 1;
  const hasNext = pageCount > 0 && page < pageCount;
  const displayPage = pendingPage ?? (pageCount === 0 ? 0 : page);
  const safePageCount = Math.max(pageCount, 1);

  const sizeOptions = pageSizeOptions.length > 0 ? pageSizeOptions : DEFAULT_PAGE_SIZE_OPTIONS;

  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-center md:justify-between", className)}>
      <PaginationSummary label={summaryLabel} start={start} end={end} total={totalItems} />

      <div className={cn("flex flex-wrap items-center gap-3", isCompact && "w-full justify-between md:w-auto")}>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600" htmlFor="pagination-page-size">
            Rows per page
          </label>
          <Select
            id="pagination-page-size"
            className="w-24"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            disabled={disabled}
            options={sizeOptions.map((option) => ({
              label: option.toString(),
              value: option,
            }))}
          />
        </div>

        <div className="flex items-center gap-1" aria-label="Pagination navigation">
          <IconButton
            icon={ChevronsLeft}
            label="First page"
            onClick={() => onPageChange(1)}
            disabled={disabled || !hasPrevious}
          />
          <IconButton
            icon={ChevronLeft}
            label="Previous page"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || !hasPrevious}
          />

          <p className="min-w-[120px] text-center text-sm text-slate-600" aria-live="polite" aria-atomic="true">
            Page{" "}
            <span className="font-semibold text-slate-900">
              {displayPage}
              {pendingPage ? "*" : ""}
            </span>{" "}
            of <span className="font-semibold text-slate-900">{safePageCount}</span>
          </p>

          <IconButton
            icon={ChevronRight}
            label="Next page"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || !hasNext}
          />
          <IconButton
            icon={ChevronsRight}
            label="Last page"
            onClick={() => onPageChange(pageCount)}
            disabled={disabled || !hasNext}
          />
        </div>
      </div>
    </div>
  );
}

type IconButtonProps = {
  icon: LucideIcon;
  onClick: () => void;
  label: string;
  disabled?: boolean;
};

function IconButton({ icon: Icon, onClick, label, disabled = false }: IconButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="h-9 w-9"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
