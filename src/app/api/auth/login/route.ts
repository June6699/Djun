import { NextResponse } from "next/server";
import { z } from "zod";
import { cmsUnavailableResponse, isCmsDisabled } from "@/lib/cloudflare-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  if (isCmsDisabled()) {
    return cmsUnavailableResponse();
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload" }, { status: 400 });
  }

  const [{ createSessionToken, writeSessionCookie }, { authenticateAdmin }] = await Promise.all([
    import("@/lib/auth"),
    import("@/lib/db")
  ]);
  const user = authenticateAdmin(parsed.data.username, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const response = NextResponse.json({ user });
  const cookie = writeSessionCookie(createSessionToken(user.id));
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
