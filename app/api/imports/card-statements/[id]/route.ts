import { NextRequest, NextResponse } from "next/server";

import { ensureApiAuthenticated } from "@/lib/auth/api";
import { getCardStatementImport } from "@/lib/card-import/service";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const statement = await getCardStatementImport(id);
  if (!statement) {
    return NextResponse.json({ error: "Statement import not found" }, { status: 404 });
  }

  return NextResponse.json(statement);
}
