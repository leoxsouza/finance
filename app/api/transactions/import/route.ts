import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

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
    const csvString = Buffer.from(buffer).toString("utf-8");
    const normalizedCsv = csvString.replace(/\r\n/g, "\n").trim();
    const fileHash = createHash("sha256").update(normalizedCsv).digest("hex");

    const parsed = parseExpenseCsv(normalizedCsv);

    if (parsed.rows.length === 0 && parsed.errors.length > 0) {
      return NextResponse.json(
        {
          error: "CSV file has no valid rows",
          created: 0,
          skipped: 0,
          errors: parsed.errors,
        },
        { status: 400 },
      );
    }

    const { resolved, errors: envelopeErrors } = await resolveEnvelopeIds(parsed.rows, prisma);

    if (resolved.length === 0) {
      return NextResponse.json(
        {
          error: "Unable to import CSV rows",
          created: 0,
          skipped: 0,
          errors: [...parsed.errors, ...envelopeErrors],
        },
        { status: 400 },
      );
    }

    const deduped = dedupeExpenseRows(resolved);

    const skipped = resolved.length - deduped.length;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transactionImport.findUnique({
        where: { fileHash },
        select: { id: true },
      });

      const importRecord = await tx.transactionImport.upsert({
        where: { fileHash },
        create: {
          fileHash,
          fileName: file.name,
          fileSize: file.size,
        },
        update: {
          fileName: file.name,
          fileSize: file.size,
        },
        select: { id: true },
      });

      const overwritten = Boolean(existing);

      if (overwritten) {
        await tx.transaction.deleteMany({
          where: {
            transactionImportId: importRecord.id,
          },
        });
      }

      const created = await tx.transaction.createMany({
        data: deduped.map((row) => ({
          date: new Date(row.date),
          description: row.description,
          value: row.value,
          type: "OUT",
          envelopeId: row.envelopeId,
          transactionImportId: importRecord.id,
        })),
      });

      return {
        overwritten,
        created: created.count,
      };
    });

    return NextResponse.json({
      created: result.created,
      skipped,
      overwritten: result.overwritten,
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
