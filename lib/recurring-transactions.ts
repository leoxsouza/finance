import prisma from "./db";
import finance from "./finance";

type TransactionTemplate = {
  id: number;
  date: Date;
  description: string;
  value: number;
  type: "IN" | "OUT";
  envelopeId: number | null;
  Envelope: { id: number; name: string; percentage: number } | null;
};

export async function generateRecurringTransactions(
  targetMonth: string,
  endDateFilter?: string | null
): Promise<{ generated: number; errors: string[] }> {
  const { start, end } = finance.getMonthRange(targetMonth);
  const errors: string[] = [];
  let generated = 0;

  // Get all transactions marked as recurring (using description pattern)
  const recurringTransactions = await prisma.transaction.findMany({
    where: {
      description: { contains: "[RECURRING]" },
    },
    include: { Envelope: true },
    orderBy: { date: "asc" },
  });

  // Group by description pattern to find unique recurring patterns
  const recurringPatterns = new Map<string, typeof recurringTransactions[0]>();
  
  for (const transaction of recurringTransactions) {
    const baseDescription = transaction.description.replace(" [RECURRING]", "");
    if (!recurringPatterns.has(baseDescription)) {
      recurringPatterns.set(baseDescription, transaction);
    }
  }

  for (const [baseDescription, template] of recurringPatterns) {
    try {
      const result = await generateMonthlyTransactions(
        template as TransactionTemplate,
        baseDescription,
        targetMonth,
        start,
        end,
        endDateFilter
      );
      generated += result.count;
    } catch (error) {
      errors.push(`Pattern "${baseDescription}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { generated, errors };
}

async function generateMonthlyTransactions(
  template: TransactionTemplate,
  baseDescription: string,
  targetMonth: string,
  monthStart: Date,
  monthEnd: Date,
  endDateFilter?: string | null
): Promise<{ count: number }> {
  // Check if transactions already exist for this month
  const existingCount = await prisma.transaction.count({
    where: {
      description: baseDescription,
      date: { gte: monthStart, lt: monthEnd },
    },
  });

  if (existingCount > 0) {
    return { count: 0 }; // Already generated for this month
  }

  // Calculate target date for this month
  const dayOfMonth = template.date.getUTCDate();
  const targetDate = calculateTargetDate(dayOfMonth, targetMonth);
  
  // Validate date is after template transaction (start date)
  if (targetDate <= template.date) {
    return { count: 0 };
  }

  // Apply end date filter if provided (UI-only constraint)
  if (endDateFilter && targetDate > new Date(endDateFilter)) {
    return { count: 0 };
  }

  // Create the transaction
  await prisma.transaction.create({
    data: {
      date: targetDate,
      description: baseDescription,
      value: template.value,
      type: template.type,
      envelopeId: template.envelopeId,
    },
  });

  return { count: 1 };
}

function calculateTargetDate(dayOfMonth: number, month: string): Date {
  const [year, monthStr] = month.split("-");
  const monthIndex = Number(monthStr) - 1;
  const yearNum = Number(year);

  // Get last day of the target month
  const lastDayOfMonth = new Date(Date.UTC(yearNum, monthIndex + 1, 0)).getUTCDate();
  
  // Use the earlier of requested day or last day of month
  const targetDay = Math.min(dayOfMonth, lastDayOfMonth);
  
  return new Date(Date.UTC(yearNum, monthIndex, targetDay));
}
