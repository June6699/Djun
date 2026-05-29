import { NextResponse } from "next/server";
import { z } from "zod";
import { cmsUnavailableResponse, isCmsDisabled } from "@/lib/cloudflare-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  slug: z.string().optional(),
  titleEn: z.string().optional(),
  titleZh: z.string().optional(),
  location: z.string().optional(),
  dateLabel: z.string().optional(),
  shortCopy: z.string().optional(),
  quote: z.string().optional(),
  themeColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundTone: z.string().optional(),
  autoSeconds: z.number().int().optional(),
  isPublished: z.boolean().optional()
});

export async function POST(request: Request) {
  if (isCmsDisabled()) {
    return cmsUnavailableResponse();
  }

  const [{ requireAdminResponse }, { createChapter }] = await Promise.all([import("@/lib/api"), import("@/lib/db")]);
  const { response } = await requireAdminResponse();
  if (response) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chapter payload" }, { status: 400 });
  }

  const state = await createChapter(parsed.data);
  return NextResponse.json({ state });
}
