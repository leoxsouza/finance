export type EnvelopeOption = {
  id: number;
  name: string;
};

export type TransactionRow = {
  id: number;
  date: string; // ISO
  description: string;
  value: number;
  type: "IN" | "OUT";
  envelopeId: number | null;
  envelopeName?: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
};

export type TransactionsFilters = {
  month: string;
  type: "" | "IN" | "OUT";
  envelopeId: string;
  installment: "" | "INSTALLMENT" | "NON_INSTALLMENT";
};

export type SortField = "date" | "description" | "value" | "type" | "envelopeName";
export type SortOrder = "asc" | "desc";
export type SortState = {
  sortBy: SortField;
  sortOrder: SortOrder;
};

export type TransactionsListResponse = {
  items: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type RecurringTransactionRow = {
  id: number;
  baseDescription: string;
  description: string;
  value: number;
  type: "IN" | "OUT";
  envelopeId: number | null;
  envelopeName?: string | null;
  dayOfMonth: number;
  startDate: string;
  isActive: boolean;
};

export type TransactionWithRecurringInput = {
  date: string;
  description: string;
  value: number;
  type: "IN" | "OUT";
  envelopeId?: number;
  isRecurring?: boolean;
  endDate?: string | null;
};
