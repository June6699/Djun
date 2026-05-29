import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAdminUser();
  return NextResponse.json({ user });
}
