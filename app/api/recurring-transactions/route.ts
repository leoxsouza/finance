import { NextResponse } from "next/server";
import { ensureApiAuthenticated } from "@/lib/auth/api";
import prisma from "@/lib/db";

export async function GET() {
  const authError = await ensureApiAuthenticated();
  if (authError) return authError;

  try {
    // Get all transactions marked as recurring
    const recurringTransactions = await prisma.transaction.findMany({
      where: {
        description: { contains: "[RECURRING]" },
      },
      include: { Envelope: true },
      orderBy: { date: "desc" },
    });

    // Group by description pattern to find unique recurring patterns
    const recurringPatterns = new Map<string, {
      id: number;
      baseDescription: string;
      description: string;
      value: number;
      type: "IN" | "OUT";
      envelopeId: number | null;
      envelopeName: string | null;
      dayOfMonth: number;
      startDate: string;
      isActive: boolean;
    }>();
    
    for (const transaction of recurringTransactions) {
      const baseDescription = transaction.description.replace(" [RECURRING]", "");
      if (!recurringPatterns.has(baseDescription)) {
        recurringPatterns.set(baseDescription, {
          id: transaction.id,
          baseDescription,
          description: transaction.description,
          value: transaction.value,
          type: transaction.type as "IN" | "OUT",
          envelopeId: transaction.envelopeId,
          envelopeName: transaction.Envelope?.name ?? null,
          dayOfMonth: transaction.date.getUTCDate(),
          startDate: transaction.date.toISOString(),
          isActive: true, // Always active since we can't track this
        });
      }
    }

    return NextResponse.json({
      items: Array.from(recurringPatterns.values()),
    });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
