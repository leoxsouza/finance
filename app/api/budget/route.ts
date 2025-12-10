import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/db";
import finance from "@/lib/finance";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
  message: "Month must be in YYYY-MM format",
});

const budgetSchema = z.object({
  month: monthSchema,
  income: z.number().min(0, "Income must be non-negative"),
});

export async function GET(request: NextRequest) {
  try {
    const monthParam = request.nextUrl.searchParams.get("month");
    const month = monthParam ?? finance.getCurrentMonth();
    monthSchema.parse(month);

    const budget = await prisma.monthlyBudget.findUnique({ where: { month } });

    if (!budget) {
      return NextResponse.json(
        { error: "Budget not found for requested month" },
        { status: 404 },
      );
    }

    return NextResponse.json(budget);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = budgetSchema.parse(await request.json());

    const upserted = await prisma.monthlyBudget.upsert({
      where: { month: payload.month },
      update: { income: payload.income },
      create: payload,
    });

    return NextResponse.json(upserted, { status: 200 });
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
