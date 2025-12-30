import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { z } from "zod";
import { transactionWithRecurringSchema } from "./schemas";

export const createSingleTransaction = async (payload: z.infer<typeof transactionWithRecurringSchema>) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isRecurring, endDate, ...transactionData } = payload;
  
  const created = await prisma.transaction.create({
    data: {
      ...transactionData,
      date: new Date(transactionData.date),
    },
    include: { Envelope: true },
  });

  return NextResponse.json({
    id: created.id,
    date: created.date.toISOString(),
    description: created.description,
    value: created.value,
    type: created.type as "IN" | "OUT",
    envelopeId: created.envelopeId ?? null,
    envelopeName: created.Envelope?.name ?? null,
  }, { status: 201 });
};

export const createRecurringTransaction = async (payload: z.infer<typeof transactionWithRecurringSchema>) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isRecurring, endDate, ...transactionData } = payload;
  
  // Validate envelope for expenses
  if (transactionData.type === "OUT" && !transactionData.envelopeId) {
    return NextResponse.json(
      { error: "Envelope is required for recurring expenses" },
      { status: 400 }
    );
  }

  // Validate end date is after start date
  if (endDate && endDate <= transactionData.date) {
    return NextResponse.json(
      { error: "End date must be after the start date" },
      { status: 400 }
    );
  }

  // Create the base recurring transaction with [RECURRING] tag
  const created = await prisma.transaction.create({
    data: {
      ...transactionData,
      date: new Date(transactionData.date),
      description: `${transactionData.description} [RECURRING]`,
    },
    include: { Envelope: true },
  });

  // Generate transactions for the period
  try {
    const startDate = new Date(transactionData.date);
    const targetEndDate = endDate ? new Date(endDate) : new Date();
    targetEndDate.setMonth(targetEndDate.getMonth() + 1); // Include current month
    
    let generatedCount = 0;
    const currentDate = new Date(startDate);
    
    // Generate transactions month by month
    while (currentDate < targetEndDate) {
      // Skip the first month since we already created the base transaction
      if (currentDate > startDate) {
        const monthString = currentDate.toISOString().slice(0, 7); // YYYY-MM format
        
        // Check if transaction already exists for this month
        const existing = await prisma.transaction.findFirst({
          where: {
            description: transactionData.description,
            date: {
              gte: new Date(monthString + "-01"),
              lt: new Date(new Date(monthString + "-01").setMonth(new Date(monthString + "-01").getMonth() + 1)),
            },
          },
        });

        if (!existing) {
          await prisma.transaction.create({
            data: {
              date: new Date(currentDate),
              description: transactionData.description,
              value: transactionData.value,
              type: transactionData.type,
              envelopeId: transactionData.envelopeId,
            },
          });
          generatedCount++;
        }
      }
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return NextResponse.json(
      {
        id: created.id,
        date: created.date.toISOString(),
        description: created.description,
        value: created.value,
        type: created.type as "IN" | "OUT",
        envelopeId: created.envelopeId ?? null,
        envelopeName: created.Envelope?.name ?? null,
        isRecurring: true,
        generatedCount,
      },
      { status: 201 },
    );
  } catch (error) {
    // If generation fails, still return the base transaction
    console.error("Failed to generate recurring transactions:", error);
    return NextResponse.json(
      {
        id: created.id,
        date: created.date.toISOString(),
        description: created.description,
        value: created.value,
        type: created.type as "IN" | "OUT",
        envelopeId: created.envelopeId ?? null,
        envelopeName: created.Envelope?.name ?? null,
        isRecurring: true,
        generatedCount: 0,
      },
      { status: 201 },
    );
  }
};
