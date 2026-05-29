import { NextResponse } from "next/server";
import { getLibraryState } from "@/lib/db";
import { requireAdminResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { user, response } = await requireAdminResponse();
  if (response) return response;

  const state = await getLibraryState(true);
  return NextResponse.json({ user, state });
}
