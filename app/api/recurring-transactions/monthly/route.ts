import { NextResponse, type NextRequest } from "next/server";
import { ensureApiAuthenticated } from "@/lib/auth/api";
import { generateRecurringTransactions } from "@/lib/recurring-transactions";
import finance from "@/lib/finance";
import { logger } from "@/lib/logger";

// Simple in-memory rate limiting (for production, use Redis or similar)
const lastGenerationByUser = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

async function getCurrentUserId(): Promise<string> {
  // TODO: Implement this helper to get current user ID from auth
  // For now, return a placeholder
  return "user-placeholder";
}

export async function POST(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) return authError;

  try {
    const userId = await getCurrentUserId();
    
    // Rate limiting check
    const lastGeneration = lastGenerationByUser.get(userId) || 0;
    const now = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { month } = await request.json();
    
    if (now - lastGeneration < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: "Please wait before generating recurring transactions again" },
        { status: 429 }
      );
    }

    const targetMonth = finance.getCurrentMonth();
    
    logger.info(`Monthly recurring transaction generation for user: ${userId}, month: ${targetMonth}`);
    
    const result = await generateRecurringTransactions(targetMonth);
    
    // Update rate limit
    lastGenerationByUser.set(userId, now);
    
    logger.info(`Monthly generation completed for user ${userId}: ${result.generated} transactions created`);
    
    return NextResponse.json({
      success: true,
      month: targetMonth,
      generated: result.generated,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('Monthly recurring transaction generation failed', error);
    return NextResponse.json(
      { error: "Failed to generate recurring transactions" },
      { status: 500 }
    );
  }
}
