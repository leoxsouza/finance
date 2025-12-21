import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ensureApiAuthenticated } from "@/lib/auth/api";
import prisma from "@/lib/db";
import finance from "@/lib/finance";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid date",
  });

const transactionDeleteQuerySchema = z.object({
  id: z
    .string()
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0, {
      message: "id must be a positive integer",
    }),
});

const transactionInputSchema = z
  .object({
    date: dateStringSchema,
    description: z.string().min(1, "Description is required"),
    value: z.number().positive("Value must be positive"),
    type: z.enum(["IN", "OUT"]),
    envelopeId: z.number().int().positive().optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.type === "OUT" && !payload.envelopeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["envelopeId"],
        message: "Envelope is required for expenses",
      });
    }
  });

export async function DELETE(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const query = transactionDeleteQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

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
});

export async function GET(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const query = transactionsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const month = query.month ?? finance.getCurrentMonth();
    const { start, end } = finance.getMonthRange(month);

    const where = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.envelopeId ? { envelopeId: query.envelopeId } : {}),
      date: {
        gte: start,
        lt: end,
      },
    };

    const transactions = await prisma.transaction.findMany({
      where,
      include: { Envelope: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    const serialized = transactions.map((transaction: (typeof transactions)[number]) => ({
      id: transaction.id,
      date: transaction.date.toISOString(),
      description: transaction.description,
      value: transaction.value,
      type: transaction.type as "IN" | "OUT",
      envelopeId: transaction.envelopeId,
      envelopeName: transaction.Envelope?.name ?? null,
    }));

    return NextResponse.json(serialized);
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
    const payload = transactionInputSchema.parse(await request.json());

    const envelopeId = payload.type === "OUT" ? payload.envelopeId! : undefined;
    if (envelopeId) {
      const envelope = await prisma.envelope.findUnique({ where: { id: envelopeId } });
      if (!envelope) {
        return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
      }
    }

    const created = await prisma.transaction.create({
      data: {
        date: new Date(payload.date),
        description: payload.description,
        value: payload.value,
        type: payload.type,
        ...(envelopeId ? { envelopeId } : {}),
      },
      include: { Envelope: true },
    });

    return NextResponse.json(
      {
        id: created.id,
        date: created.date.toISOString(),
        description: created.description,
        value: created.value,
        type: created.type as "IN" | "OUT",
        envelopeId: created.envelopeId ?? null,
        envelopeName: created.Envelope?.name ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
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
