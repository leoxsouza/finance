import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/serverSession";

export async function ensureApiAuthenticated() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
