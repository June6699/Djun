import { NextResponse } from "next/server";

export function isCmsDisabled() {
  return process.env.DJUN_DISABLE_CMS === "1";
}

export function cmsUnavailableResponse() {
  return NextResponse.json({ error: "CMS unavailable on Cloudflare Workers" }, { status: 503 });
}
