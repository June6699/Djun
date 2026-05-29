import { NextResponse } from "next/server";
import { cmsUnavailableResponse, isCmsDisabled } from "@/lib/cloudflare-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (isCmsDisabled()) {
    return cmsUnavailableResponse();
  }

  const [{ requireAdminResponse }, { getLibraryState }] = await Promise.all([import("@/lib/api"), import("@/lib/db")]);
  const { user, response } = await requireAdminResponse();
  if (response) return response;

  const state = await getLibraryState(true);
  return NextResponse.json({ user, state });
}
