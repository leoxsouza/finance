import * as React from "react";

import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-100 bg-white">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm text-slate-700", className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn("text-xs uppercase tracking-wide text-slate-500", className)}
      {...props}
    />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("divide-y divide-slate-100", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("bg-slate-50 font-medium text-slate-900", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("hover:bg-slate-50", className)} {...props} />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn("px-4 py-2 text-left font-medium text-slate-500", className)}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-4 py-3 align-middle", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = ({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) => (
  <caption className={cn("mt-4 text-sm text-slate-500", className)} {...props} />
);

// Sortable table header components
interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  field: string;
  currentSort: { sortBy: string; sortOrder: "asc" | "desc" };
  onSortChange: (field: string) => void;
  children: React.ReactNode;
}

const SortIcon = ({ direction }: { direction: "asc" | "desc" | "none" }) => {
  if (direction === "none") {
    return (
      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }

  return (
    <svg 
      className={cn(
        "h-4 w-4 transition-colors",
        direction === "asc" ? "text-slate-700" : "text-slate-700"
      )} 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      {direction === "asc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      )}
    </svg>
  );
};

const SortableTableHead = React.forwardRef<HTMLTableCellElement, SortableTableHeadProps>(
  ({ field, currentSort, onSortChange, children, className, ...props }, ref) => {
    const isActive = currentSort.sortBy === field;
    const sortDirection = isActive ? currentSort.sortOrder : "none";

    return (
      <th
        ref={ref}
        className={cn(
          "px-4 py-2 text-left font-medium text-slate-500",
          "cursor-pointer select-none hover:bg-slate-50 hover:text-slate-700",
          "transition-colors duration-150",
          className
        )}
        onClick={() => onSortChange(field)}
        aria-sort={isActive ? (currentSort.sortOrder === "asc" ? "ascending" : "descending") : "none"}
        {...props}
      >
        <div className="flex items-center gap-2">
          {children}
          <SortIcon direction={sortDirection} />
        </div>
      </th>
    );
  },
);
SortableTableHead.displayName = "SortableTableHead";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableCell,
  TableCaption,
  TableRow,
  SortableTableHead,
};
