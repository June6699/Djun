import { NextResponse } from "next/server";
import { forceRescanLibrary } from "@/lib/db";
import { requireAdminResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { response } = await requireAdminResponse();
  if (response) return response;

  const scan = await forceRescanLibrary();
  return NextResponse.json({ scan });
}
