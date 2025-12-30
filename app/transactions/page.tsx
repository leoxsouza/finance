import { requireSession } from "@/lib/auth/serverSession";
import prisma from "@/lib/db";
import finance from "@/lib/finance";
import {
  DEFAULT_TRANSACTIONS_PAGE,
  DEFAULT_TRANSACTIONS_PAGE_SIZE,
  TRANSACTION_PAGE_SIZE_OPTIONS,
  type TransactionPageSizeOption,
} from "@/lib/transactions/constants";

import TransactionsPageClient from "./TransactionsPageClient";
import type { EnvelopeOption, TransactionRow, TransactionsFilters } from "@/types/transactions";

type PageSearchParams = Record<string, string | string[] | undefined>;

function getParamValue(searchParams: PageSearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMonth(value: string | undefined, fallback: string) {
  if (value && MONTH_PATTERN.test(value)) {
    return value;
  }
  return fallback;
}

function parseType(value: string | undefined): "" | "IN" | "OUT" {
  if (value === "IN" || value === "OUT") {
    return value;
  }
  return "";
}

function parseEnvelopeId(value: string | undefined): string {
  if (!value) {
    return "";
  }
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) {
    return value;
  }
  return "";
}

function parsePage(value: string | undefined) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }
  return DEFAULT_TRANSACTIONS_PAGE;
}

function parsePageSize(value: string | undefined) {
  const numeric = Number(value);
  if (TRANSACTION_PAGE_SIZE_OPTIONS.includes(numeric as TransactionPageSizeOption)) {
    return numeric;
  }
  return DEFAULT_TRANSACTIONS_PAGE_SIZE;
}

function parseSortBy(value: string | undefined): "date" | "description" | "value" | "type" | "envelopeName" {
  if (value === "date" || value === "description" || value === "value" || value === "type" || value === "envelopeName") {
    return value;
  }
  return "date"; // Default sort field
}

function parseSortOrder(value: string | undefined): "asc" | "desc" {
  if (value === "asc" || value === "desc") {
    return value;
  }
  return "desc"; // Default sort order
}

async function getInitialData(searchParams: PageSearchParams) {
  const baseMonth = finance.getCurrentMonth();
  const month = parseMonth(getParamValue(searchParams, "month"), baseMonth);
  const type = parseType(getParamValue(searchParams, "type"));
  const envelopeId = parseEnvelopeId(getParamValue(searchParams, "envelopeId"));
  const initialPage = parsePage(getParamValue(searchParams, "page"));
  const pageSize = parsePageSize(getParamValue(searchParams, "pageSize"));
  const sortBy = parseSortBy(getParamValue(searchParams, "sortBy"));
  const sortOrder = parseSortOrder(getParamValue(searchParams, "sortOrder"));

  const { start, end } = finance.getMonthRange(month);
  const envelopeIdNumeric = envelopeId ? Number(envelopeId) : undefined;

  const where = {
    ...(type ? { type } : {}),
    ...(envelopeIdNumeric ? { envelopeId: envelopeIdNumeric } : {}),
    date: {
      gte: start,
      lt: end,
    },
  };

  // Field mapping for sorting
  const sortFieldMapping = {
    date: "date",
    description: "description",
    value: "value",
    type: "type",
    envelopeName: "Envelope.name",
  } as const;

  // Build dynamic orderBy clause
  let orderBy: Array<{ [key: string]: "asc" | "desc" }> = [];
  const field = sortFieldMapping[sortBy];
  if (field) {
    orderBy.push({ [field]: sortOrder });
  }
  
  // Default ordering if no valid sort field
  if (orderBy.length === 0) {
    orderBy = [{ date: "desc" }, { createdAt: "desc" }];
  }

  const [envelopes, total] = await Promise.all([
    prisma.envelope.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.count({ where }),
  ]);

  const safePageCount = total === 0 ? 1 : Math.max(Math.ceil(total / pageSize), 1);
  const safePage = total === 0 ? 1 : Math.min(initialPage, safePageCount);

  const transactions = await prisma.transaction.findMany({
    where,
    include: { 
      Envelope: true,
      CardPurchase: {
        select: {
          metadata: true,
          installments: {
            select: { installmentNumber: true, installmentCount: true },
            orderBy: { installmentNumber: "asc" },
            take: 1
          }
        }
      }
    },
    orderBy,
    skip: total === 0 ? 0 : (safePage - 1) * pageSize,
    take: pageSize,
  });

  const safeEnvelopes = envelopes.map<EnvelopeOption>((envelope) => ({
    id: envelope.id,
    name: envelope.name,
  }));

  const safeTransactions = transactions.map<TransactionRow>((transaction) => {
      const metadata = transaction.CardPurchase?.metadata as Record<string, unknown> | null;
      const installmentNumber = (metadata?.installmentNumber as number) ?? 
        transaction.CardPurchase?.installments?.[0]?.installmentNumber ?? null;
      const installmentCount = (metadata?.installmentCount as number) ?? 
        transaction.CardPurchase?.installments?.[0]?.installmentCount ?? null;

      return {
        id: transaction.id,
        date: transaction.date.toISOString(),
        description: transaction.description,
        value: transaction.value,
        type: transaction.type === "IN" ? "IN" : "OUT",
        envelopeId: transaction.envelopeId,
        envelopeName: transaction.Envelope?.name ?? null,
        installmentNumber,
        installmentCount,
      };
    });

  const filters: TransactionsFilters = {
    month,
    type,
    envelopeId,
    installment: "",
  };

  return {
    month,
    envelopes: safeEnvelopes,
    transactions: safeTransactions,
    filters,
    pagination: {
      page: safePage,
      pageSize,
      total,
    },
    sortState: {
      sortBy,
      sortOrder,
    },
  };
}

type TransactionsPageProps = {
  searchParams?: PageSearchParams;
};

async function TransactionsPage({ searchParams = {} }: TransactionsPageProps) {
  await requireSession();
  const { month, envelopes, transactions, filters, pagination, sortState } = await getInitialData(searchParams);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-2 pb-12 sm:px-0">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Transactions</p>
        <h1 className="text-3xl font-semibold text-slate-900">Track income & expenses</h1>
        <p className="text-base text-slate-600">
          Record every movement and keep an eye on how each envelope is behaving. Filter by month, category, or type to
          audit your history quickly.
        </p>
      </header>

      <TransactionsPageClient
        envelopes={envelopes}
        initialTransactions={transactions}
        initialFilters={filters}
        initialPagination={pagination}
        defaultMonth={month}
        initialSortState={sortState}
      />
    </section>
  );
}

export default TransactionsPage;
