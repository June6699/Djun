import { NextResponse } from "next/server";
import { z } from "zod";
import { reorderPhotos } from "@/lib/db";
import { requireAdminResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  chapterId: z.string().nullable(),
  photoIds: z.array(z.string().min(1))
});

export async function POST(request: Request) {
  const { response } = await requireAdminResponse();
  if (response) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
  }

  const state = await reorderPhotos(parsed.data.chapterId, parsed.data.photoIds);
  return NextResponse.json({ state });
}
