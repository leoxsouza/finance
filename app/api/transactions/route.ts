import { NextResponse, type NextRequest } from "next/server";
import { ensureApiAuthenticated } from "@/lib/auth/api";
import { z } from "zod";
import prisma from "@/lib/db";
import finance from "@/lib/finance";
import { createSingleTransaction, createRecurringTransaction } from "./recurring-functions";
import { transactionWithRecurringSchema, transactionUpdateSchema } from "./schemas";
import {
  DEFAULT_TRANSACTIONS_PAGE,
  DEFAULT_TRANSACTIONS_PAGE_SIZE,
  TRANSACTION_PAGE_SIZE_OPTIONS,
  type TransactionPageSizeOption,
} from "@/lib/transactions/constants";

const transactionUpdateQuerySchema = z.object({
  id: z
    .string()
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0, {
      message: "id must be a positive integer",
    }),
});

export async function DELETE(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const query = transactionUpdateQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    await prisma.transaction.delete({
      where: { id: query.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return handleError(error);
  }
}

const transactionsQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  type: z.enum(["IN", "OUT"]).optional(),
  envelopeId: z
    .string()
    .transform((value) => (value ? Number(value) : undefined))
    .refine((value) => value === undefined || (Number.isInteger(value) && value > 0), {
      message: "envelopeId must be a positive integer",
    })
    .optional(),
  installment: z.enum(["INSTALLMENT", "NON_INSTALLMENT"]).optional(),
  page: z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0, { message: "page must be a positive integer" })
    .optional(),
  pageSize: z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine((value) => TRANSACTION_PAGE_SIZE_OPTIONS.includes(value as TransactionPageSizeOption), {
      message: `pageSize must be one of ${TRANSACTION_PAGE_SIZE_OPTIONS.join(", ")}`,
    })
    .optional(),
  sortBy: z.enum(["date", "description", "value", "type", "envelopeName"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export async function GET(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const query = transactionsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const page = query.page ?? DEFAULT_TRANSACTIONS_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_TRANSACTIONS_PAGE_SIZE;

    const month = query.month ?? finance.getCurrentMonth();
    const { start, end } = finance.getMonthRange(month);

    const where = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.envelopeId ? { envelopeId: query.envelopeId } : {}),
      ...(query.installment ? {
        [query.installment === "INSTALLMENT" ? "cardPurchaseId" : "cardPurchaseId"]: 
          query.installment === "INSTALLMENT" ? { not: null } : null
      } : {}),
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
    if (query.sortBy && query.sortOrder) {
      const field = sortFieldMapping[query.sortBy];
      if (field) {
        orderBy.push({ [field]: query.sortOrder });
      }
    }
    
    // Default ordering if no sort parameters provided
    if (orderBy.length === 0) {
      orderBy = [{ date: "desc" }, { createdAt: "desc" }];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
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
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    const serialized = transactions.map((transaction: (typeof transactions)[number]) => {
      // Extract installment metadata from CardPurchase if available
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
        type: transaction.type as "IN" | "OUT",
        envelopeId: transaction.envelopeId,
        envelopeName: transaction.Envelope?.name ?? null,
        installmentNumber,
        installmentCount,
      };
    });

    return NextResponse.json({
      items: serialized,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const payload = transactionWithRecurringSchema.parse(await request.json());

    if (payload.isRecurring) {
      return await createRecurringTransaction(payload);
    } else {
      return await createSingleTransaction(payload);
    }
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const query = transactionUpdateQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const payload = transactionUpdateSchema.parse(await request.json());

    // Validate envelope exists if provided
    if (payload.envelopeId) {
      const envelope = await prisma.envelope.findUnique({ where: { id: payload.envelopeId } });
      if (!envelope) {
        return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
      }
    }

    const updated = await prisma.transaction.update({
      where: { id: query.id },
      data: {
        ...(payload.date && { date: new Date(payload.date) }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.value !== undefined && { value: payload.value }),
        ...(payload.type !== undefined && { type: payload.type }),
        ...(payload.envelopeId !== undefined && { 
          envelopeId: payload.envelopeId 
        }),
      },
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
    });

    // Extract installment metadata for response
    const metadata = updated.CardPurchase?.metadata as Record<string, unknown> | null;
    const installmentNumber = (metadata?.installmentNumber as number) ?? 
      updated.CardPurchase?.installments?.[0]?.installmentNumber ?? null;
    const installmentCount = (metadata?.installmentCount as number) ?? 
      updated.CardPurchase?.installments?.[0]?.installmentCount ?? null;

    return NextResponse.json({
      id: updated.id,
      date: updated.date.toISOString(),
      description: updated.description,
      value: updated.value,
      type: updated.type as "IN" | "OUT",
      envelopeId: updated.envelopeId ?? null,
      envelopeName: updated.Envelope?.name ?? null,
      installmentNumber,
      installmentCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Record to update does not exist")) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
