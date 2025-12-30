import { NextResponse, type NextRequest } from "next/server";
import { ensureApiAuthenticated } from "@/lib/auth/api";
import { generateRecurringTransactions } from "@/lib/recurring-transactions";
import finance from "@/lib/finance";

export async function POST(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) return authError;

  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { month } = await request.json();
    const result = await generateRecurringTransactions(month || finance.getCurrentMonth());
    
    return NextResponse.json(result);
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
