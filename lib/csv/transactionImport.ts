import { Buffer } from "node:buffer";
import type { PrismaClient } from "@prisma/client";

export type ParsedExpenseRow = {
  rowNumber: number;
  description: string;
  date: string; // YYYY-MM-DD
  value: number;
  envelopeName: string;
};

export type CsvParseError = {
  rowNumber: number;
  message: string;
};

export type ParsedExpenseCsv = {
  rows: ParsedExpenseRow[];
  errors: CsvParseError[];
};

const REQUIRED_HEADERS = {
  description: "Contas",
  date: "Data de Compra",
  value: "Valor Total",
  envelope: "Tipo",
} as const;

const MAX_VALUE = 1_000_000_000;

export function parseExpenseCsv(input: ArrayBuffer | string): ParsedExpenseCsv {
  const csvString = typeof input === "string" ? input : bufferToString(input);
  const normalized = csvString.replace(/\r\n/g, "\n").trim();
  const rows = splitCsv(normalized);

  if (rows.length === 0) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, message: "CSV file is empty" }],
    };
  }

  const headerRow = rows.shift()!.map((cell) => cell.trim());
  const headerIndexes = {
    description: headerRow.findIndex((cell) => cell === REQUIRED_HEADERS.description),
    date: headerRow.findIndex((cell) => cell === REQUIRED_HEADERS.date),
    value: headerRow.findIndex((cell) => cell === REQUIRED_HEADERS.value),
    envelope: headerRow.findIndex((cell) => cell === REQUIRED_HEADERS.envelope),
  };

  const missingHeaders = Object.entries(headerIndexes)
    .filter(([, index]) => index === -1)
    .map(([key]) => key);

  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 0,
          message: `Missing required headers: ${missingHeaders.join(", ")}`,
        },
      ],
    };
  }

  const parsedRows: ParsedExpenseRow[] = [];
  const errors: CsvParseError[] = [];

  rows.forEach((rawRow, rowIndex) => {
    const csvRowNumber = rowIndex + 2; // include header line
    const description = rawRow[headerIndexes.description] ? rawRow[headerIndexes.description].trim() : "";
    const rawDate = rawRow[headerIndexes.date]?.trim() ?? "";
    const rawValue = rawRow[headerIndexes.value]?.trim() ?? "";
    const envelopeName = rawRow[headerIndexes.envelope]?.trim() ?? "";

    if (!description && !rawDate && !rawValue && !envelopeName) {
      return; // skip empty lines silently
    }

    if (!description) {
      errors.push({ rowNumber: csvRowNumber, message: "Description (Contas) is required" });
      return;
    }

    const date = parseBrDate(rawDate);
    if (!date) {
      errors.push({ rowNumber: csvRowNumber, message: "Invalid date format. Expected dd/MM/yyyy." });
      return;
    }

    const value = parseBrCurrency(rawValue);
    if (value === null || value <= 0 || value > MAX_VALUE) {
      errors.push({
        rowNumber: csvRowNumber,
        message: "Invalid value. Provide a positive amount using Brazilian currency format.",
      });
      return;
    }

    if (!envelopeName) {
      errors.push({ rowNumber: csvRowNumber, message: "Envelope (Tipo) is required" });
      return;
    }

    parsedRows.push({
      rowNumber: csvRowNumber,
      description,
      date,
      value,
      envelopeName,
    });
  });

  return { rows: parsedRows, errors };
}

export async function resolveEnvelopeIds(
  rows: ParsedExpenseRow[],
  prisma: Pick<PrismaClient, "envelope">,
): Promise<{
  resolved: (ParsedExpenseRow & { envelopeId: number })[];
  errors: CsvParseError[];
}> {
  const envelopeLookup = await prisma.envelope.findMany({
    select: { id: true, name: true },
  });

  const map = new Map<string, number>();
  envelopeLookup.forEach((env) => map.set(env.name.trim().toLowerCase(), env.id));

  const resolved: (ParsedExpenseRow & { envelopeId: number })[] = [];
  const errors: CsvParseError[] = [];

  rows.forEach((row) => {
    const key = row.envelopeName.trim().toLowerCase();
    const envelopeId = map.get(key);
    if (!envelopeId) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Envelope "${row.envelopeName}" not found`,
      });
    } else {
      resolved.push({ ...row, envelopeId });
    }
  });

  return { resolved, errors };
}

export function dedupeExpenseRows(rows: (ParsedExpenseRow & { envelopeId: number })[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = [row.date, row.description.trim().toLowerCase(), row.value.toFixed(2), row.envelopeId].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function bufferToString(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("utf-8");
}

function splitCsv(source: string): string[][] {
  if (!source) return [];
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  const pushField = () => {
    currentRow.push(currentField);
    currentField = "";
  };

  const pushRow = () => {
    pushField();
    rows.push(currentRow);
    currentRow = [];
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const nextChar = source[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      pushField();
    } else if (char === "\n" && !inQuotes) {
      pushRow();
    } else if (char === "\r" && nextChar === "\n") {
      continue; // handled via normalized replace
    } else {
      currentField += char;
    }
  }

  // push trailing field/row
  pushField();
  if (currentRow.length > 1 || currentRow[0] !== "") {
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function parseBrDate(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function parseBrCurrency(value: string): number | null {
  if (!value) return null;
  let sanitized = value.replace(/[R$\s]/gi, "");
  sanitized = sanitized.replace(/\./g, "").replace(",", ".");
  const numeric = Number(sanitized);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Number(numeric.toFixed(2));
}
