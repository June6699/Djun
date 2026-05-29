import { NextResponse } from "next/server";
import { isCmsDisabled } from "@/lib/cloudflare-mode";
import { getDemoLibraryState } from "@/lib/demo-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (isCmsDisabled()) {
    return NextResponse.json(getDemoLibraryState());
  }

  const { getLibraryState } = await import("@/lib/db");
  const state = await getLibraryState(false);
  return NextResponse.json(state);
}
