import { NextResponse } from "next/server";
import { z } from "zod";
import { cmsUnavailableResponse, isCmsDisabled } from "@/lib/cloudflare-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1),
  subtitle: z.string().default(""),
  description: z.string().default(""),
  autoplaySeconds: z.number().int().min(5).max(180).default(28),
  photoSeconds: z.number().int().min(2).max(30).default(5)
});

export async function PUT(request: Request) {
  if (isCmsDisabled()) {
    return cmsUnavailableResponse();
  }

  const [{ requireAdminResponse }, { updateProject }] = await Promise.all([import("@/lib/api"), import("@/lib/db")]);
  const { response } = await requireAdminResponse();
  if (response) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project payload" }, { status: 400 });
  }

  const state = await updateProject(parsed.data);
  return NextResponse.json({ state });
}
