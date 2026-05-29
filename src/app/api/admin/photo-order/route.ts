import { NextResponse } from "next/server";
import { z } from "zod";
import { cmsUnavailableResponse, isCmsDisabled } from "@/lib/cloudflare-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  chapterId: z.string().nullable(),
  photoIds: z.array(z.string().min(1))
});

export async function POST(request: Request) {
  if (isCmsDisabled()) {
    return cmsUnavailableResponse();
  }

  const [{ requireAdminResponse }, { reorderPhotos }] = await Promise.all([import("@/lib/api"), import("@/lib/db")]);
  const { response } = await requireAdminResponse();
  if (response) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
  }

  const state = await reorderPhotos(parsed.data.chapterId, parsed.data.photoIds);
  return NextResponse.json({ state });
}
