export const TRANSACTION_PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export type TransactionPageSizeOption = (typeof TRANSACTION_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_TRANSACTIONS_PAGE_SIZE: TransactionPageSizeOption = 5;
export const DEFAULT_TRANSACTIONS_PAGE = 1;
