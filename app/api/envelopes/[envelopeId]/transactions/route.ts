import { NextResponse, type NextRequest } from "next/server";
import { ensureApiAuthenticated } from "@/lib/auth/api";
import { z } from "zod";
import prisma from "@/lib/db";
import finance from "@/lib/finance";

const envelopeTransactionsQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  page: z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0, { message: "page must be a positive integer" })
    .optional(),
  pageSize: z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0 && value <= 100, { 
      message: "pageSize must be a positive integer <= 100" 
    })
    .optional(),
});

const envelopeIdSchema = z
  .string()
  .transform((value) => Number(value))
  .refine((value) => Number.isInteger(value) && value > 0, {
    message: "envelopeId must be a positive integer",
  });

export async function GET(
  request: NextRequest,
  { params }: { params: { envelopeId: string } }
) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    // Validate envelopeId from route params
    const envelopeId = envelopeIdSchema.parse(params.envelopeId);
    
    // Validate query parameters
    const query = envelopeTransactionsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    // Validate envelope exists
    const envelope = await prisma.envelope.findUnique({ where: { id: envelopeId } });
    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    // Resolve date window
    const month = query.month ?? finance.getCurrentMonth();
    const { start, end } = finance.getMonthRange(month);

    // Query transactions for this envelope
    const where = {
      envelopeId,
      type: "OUT" as const, // Only expenses should be tied to envelopes
      date: {
        gte: start,
        lt: end,
      },
    };

    // Order by date desc, createdAt desc to match transactions page defaults
    const orderBy = [{ date: "desc" as const }, { createdAt: "desc" as const }];

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

    // Map to TransactionRow format (matching existing transactions API)
    const serialized = transactions.map((transaction) => {
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
