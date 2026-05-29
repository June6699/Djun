import { NextResponse } from "next/server";
import { isCmsDisabled } from "@/lib/cloudflare-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (isCmsDisabled()) {
    return NextResponse.json({ user: null });
  }

  const { requireAdminUser } = await import("@/lib/db");
  const user = await requireAdminUser();
  return NextResponse.json({ user });
}
