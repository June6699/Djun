import { NextResponse } from "next/server";
import { cmsUnavailableResponse, isCmsDisabled } from "@/lib/cloudflare-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (isCmsDisabled()) {
    return cmsUnavailableResponse();
  }

  const [{ requireAdminResponse }, { forceRescanLibrary }] = await Promise.all([import("@/lib/api"), import("@/lib/db")]);
  const { response } = await requireAdminResponse();
  if (response) return response;

  const scan = await forceRescanLibrary();
  return NextResponse.json({ scan });
}
