import { NextResponse, type NextRequest } from "next/server";
import { ensureApiAuthenticated } from "@/lib/auth/api";
import prisma from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await ensureApiAuthenticated();
  if (authError) return authError;

  try {
    const transactionId = Number(params.id);

    // Remove the [RECURRING] marker from the base transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        description: transaction.description.replace(" [RECURRING]", ""),
      },
    });

    return NextResponse.json({ success: true });
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
