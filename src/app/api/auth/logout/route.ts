import { NextResponse } from "next/server";
import { isCmsDisabled } from "@/lib/cloudflare-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  if (isCmsDisabled()) {
    return response;
  }

  const { clearSessionCookie } = await import("@/lib/auth");
  const cookie = clearSessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
