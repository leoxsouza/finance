import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { dedupeExpenseRows, parseExpenseCsv, resolveEnvelopeIds } from "./transactionImport";

describe("parseExpenseCsv", () => {
  it("parses valid CSV rows", () => {
    const csv = [
      "Contas,Parcelas,Data de Compra,Valor Total,Tipo",
      'Teste,5,13/09/2025,"R$ 506,70",Custo fixo',
    ].join("\n");

    const parsed = parseExpenseCsv(csv);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      description: "Teste",
      date: "2025-09-13",
      value: 506.7,
      envelopeName: "Custo fixo",
    });
    expect(parsed.rows[0].rowNumber).toBe(2);
  });

  it("returns errors for invalid date", () => {
    const csv = [
      "Contas,Data de Compra,Valor Total,Tipo",
      "Teste,2025-09-13,R$ 10,00,Custo fixo",
    ].join("\n");

    const parsed = parseExpenseCsv(csv);

    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].rowNumber).toBe(2);
  });

  it("returns an error when required headers are missing", () => {
    const csv = [
      "Contas,Data de Compra,Valor Total",
      "Teste,13/09/2025,R$ 10,00",
    ].join("\n");

    const parsed = parseExpenseCsv(csv);

    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].rowNumber).toBe(0);
  });
});

describe("resolveEnvelopeIds", () => {
  it("resolves envelopes case-insensitively", async () => {
    const prisma = {
      envelope: {
        findMany: async () => [{ id: 1, name: "Custo fixo" }],
      },
    } as unknown as Pick<PrismaClient, "envelope">;

    const rows = [
      {
        rowNumber: 2,
        description: "Teste",
        date: "2025-09-13",
        value: 10,
        envelopeName: "  custo fixo ",
      },
    ];

    const { resolved, errors } = await resolveEnvelopeIds(rows, prisma);

    expect(errors).toEqual([]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].envelopeId).toBe(1);
  });

  it("returns errors for unknown envelopes", async () => {
    const prisma = {
      envelope: {
        findMany: async () => [{ id: 1, name: "Custo fixo" }],
      },
    } as unknown as Pick<PrismaClient, "envelope">;

    const rows = [
      {
        rowNumber: 2,
        description: "Teste",
        date: "2025-09-13",
        value: 10,
        envelopeName: "Unknown",
      },
    ];

    const { resolved, errors } = await resolveEnvelopeIds(rows, prisma);

    expect(resolved).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].rowNumber).toBe(2);
  });
});

describe("dedupeExpenseRows", () => {
  it("dedupes by date/description/value/envelopeId", () => {
    const rows = [
      {
        rowNumber: 2,
        description: "  Teste  ",
        date: "2025-09-13",
        value: 10.1,
        envelopeName: "Custo fixo",
        envelopeId: 1,
      },
      {
        rowNumber: 3,
        description: "teste",
        date: "2025-09-13",
        value: 10.1,
        envelopeName: "Custo fixo",
        envelopeId: 1,
      },
    ];

    const deduped = dedupeExpenseRows(rows);
    expect(deduped).toHaveLength(1);
  });
});
