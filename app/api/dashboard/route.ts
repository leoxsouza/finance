import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import finance from "@/lib/finance";

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Month must be in YYYY-MM format" })
  .optional();

export async function GET(request: NextRequest) {
  try {
    const monthParam = monthSchema.parse(request.nextUrl.searchParams.get("month") ?? undefined);
    const month = monthParam ?? finance.getCurrentMonth();

    const dashboard = await finance.buildDashboard(month);
    return NextResponse.json(dashboard);
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
  }

  if (error instanceof Error) {
    const status = error.message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
