import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ensureApiAuthenticated } from "@/lib/auth/api";
import prisma from "@/lib/db";

const envelopeBaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  percentage: z.number().min(0).max(1),
});

const envelopeUpsertSchema = envelopeBaseSchema.extend({
  id: z.number().int().positive(),
});

async function ensurePercentageBudget(options: {
  id?: number;
  percentage: number;
}) {
  const envelopes = await prisma.envelope.findMany();
  type EnvelopeRow = { id: number; percentage: number };
  const total = (envelopes as EnvelopeRow[]).reduce<number>((sum, env) => {
    if (options.id && env.id === options.id) {
      return sum;
    }
    return sum + env.percentage;
  }, 0);

  const NEW_TOTAL_TOLERANCE = 1e-6;
  if (total + options.percentage > 1 + NEW_TOTAL_TOLERANCE) {
    throw new Error("Total envelope percentage cannot exceed 100%");
  }
}

export async function GET() {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const envelopes = await prisma.envelope.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json(envelopes);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const payload = envelopeBaseSchema.parse(await request.json());
    await ensurePercentageBudget({ percentage: payload.percentage });

    const created = await prisma.envelope.create({ data: payload });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const payload = envelopeUpsertSchema.parse(await request.json());
    await ensurePercentageBudget({ id: payload.id, percentage: payload.percentage });

    const updated = await prisma.envelope.update({
      where: { id: payload.id },
      data: { name: payload.name, percentage: payload.percentage },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await ensureApiAuthenticated();
  if (authError) {
    return authError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid envelope id" }, { status: 400 });
    }

    const deleted = await prisma.envelope.delete({ where: { id } });
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
