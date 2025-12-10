import { NextResponse, type NextRequest } from "next/server";

import prisma from "@/lib/db";
import { dedupeExpenseRows, parseExpenseCsv, resolveEnvelopeIds } from "@/lib/csv/transactionImport";

const MAX_FILE_SIZE_BYTES = 1_000_000; // 1MB

export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 415 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required under the 'file' field" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "Only .csv files are supported" }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File exceeds 1MB limit" }, { status: 413 });
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseExpenseCsv(buffer);

    if (parsed.rows.length === 0 && parsed.errors.length > 0) {
      return NextResponse.json({ created: 0, skipped: 0, errors: parsed.errors }, { status: 400 });
    }

    const { resolved, errors: envelopeErrors } = await resolveEnvelopeIds(parsed.rows, prisma);

    if (resolved.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0, errors: [...parsed.errors, ...envelopeErrors] }, { status: 400 });
    }

    const deduped = dedupeExpenseRows(resolved);

    const created = await prisma.$transaction(
      deduped.map((row) =>
        prisma.transaction.create({
          data: {
            date: new Date(row.date),
            description: row.description,
            value: row.value,
            type: "OUT",
            envelopeId: row.envelopeId,
          },
        }),
      ),
    );

    return NextResponse.json({
      created: created.length,
      skipped: resolved.length - deduped.length,
      errors: [...parsed.errors, ...envelopeErrors],
    });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  console.error("[CSV Import] Unexpected error", error);
  return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
}
