import { NextResponse } from "next/server";
import { getLibraryState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getLibraryState(false);
  return NextResponse.json(state);
}
