import { NextResponse } from "next/server";
import { z } from "zod";
import { cmsUnavailableResponse, isCmsDisabled } from "@/lib/cloudflare-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  chapterId: z.string().nullable().optional(),
  title: z.string().optional(),
  caption: z.string().optional(),
  location: z.string().optional(),
  capturedAt: z.string().optional(),
  isCover: z.boolean().optional(),
  isVisible: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (isCmsDisabled()) {
    return cmsUnavailableResponse();
  }

  const [{ requireAdminResponse }, { updatePhoto }] = await Promise.all([import("@/lib/api"), import("@/lib/db")]);
  const { response } = await requireAdminResponse();
  if (response) return response;

  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid photo payload" }, { status: 400 });
  }

  const state = await updatePhoto(id, parsed.data);
  return NextResponse.json({ state });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (isCmsDisabled()) {
    return cmsUnavailableResponse();
  }

  const [{ requireAdminResponse }, { deletePhoto }] = await Promise.all([import("@/lib/api"), import("@/lib/db")]);
  const { response } = await requireAdminResponse();
  if (response) return response;

  const { id } = await context.params;
  const state = await deletePhoto(id);
  return NextResponse.json({ state });
}
