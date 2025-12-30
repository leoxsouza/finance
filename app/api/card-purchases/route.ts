import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureApiAuthenticated } from "@/lib/auth/api";
import { listCardPurchasesByMonth } from "@/lib/card-import/service";

const purchasesQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be in YYYY-MM format")
    .optional(),
});

export async function GET(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const params = purchasesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const purchases = await listCardPurchasesByMonth(params);
    return NextResponse.json(purchases);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query", details: error.flatten() }, { status: 400 });
    }
    console.error("[card-purchases:GET] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
