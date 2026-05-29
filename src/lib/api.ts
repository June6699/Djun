import "server-only";

import { NextResponse } from "next/server";
import { requireAdminUser } from "./db";

export async function requireAdminResponse() {
  const user = await requireAdminUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  return { user, response: null };
}

export function jsonError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Request failed";
  return NextResponse.json({ error: message }, { status });
}
