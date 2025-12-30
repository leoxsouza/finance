import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureApiAuthenticated } from "@/lib/auth/api";
import { getCurrentSession } from "@/lib/auth/serverSession";
import { listCardStatementImports, persistCardStatementImport } from "@/lib/card-import/service";
import { CardImportPersistenceError } from "@/lib/card-import/persistence";
import type { CardImportSession } from "@/lib/types/card-import";

const purchaseOverrideSchema = z.object({
  purchaseDate: z.string().min(1).optional(),
  auvpCategory: z.string().min(1).optional(),
  totalAmount: z.number().finite().optional(),
  installmentCount: z.number().int().positive().optional(),
});

const persistPayloadSchema = z.object({
  session: z
    .object({
      sessionId: z.string().min(1),
      meta: z
        .object({
          fileHash: z.string().min(1),
        })
        .passthrough(),
      purchases: z.array(z.any()),
      installments: z.array(z.any()),
      issues: z.array(z.any()),
    })
    .passthrough(),
  overrides: z.record(purchaseOverrideSchema).optional(),
  force: z.boolean().optional(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.coerce.number().int().positive().optional(),
});

export async function GET(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await listCardStatementImports(query);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query", details: error.flatten() }, { status: 400 });
    }
    console.error("[card-statements:GET] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const payload = persistPayloadSchema.parse(await request.json());
    const session = await getCurrentSession();
    const userId = session?.user?.email ?? "unknown";

    const result = await persistCardStatementImport({
      session: payload.session as CardImportSession,
      overrides: payload.overrides,
      userId,
      force: payload.force ?? false,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid payload", details: error.flatten() }, { status: 400 });
  }

  if (error instanceof CardImportPersistenceError) {
    const status = error.code === "DUPLICATE_IMPORT" ? 409 : error.code === "INVALID_PAYLOAD" ? 422 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  console.error("[card-statements:POST] Unexpected error", error);
  return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
}
