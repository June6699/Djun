import { NextResponse } from "next/server";
import { requireAdminResponse } from "@/lib/api";
import { saveUploadedFiles } from "@/lib/media";
import { syncMediaLibrary } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { response } = await requireAdminResponse();
  if (response) return response;

  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  const saved = await saveUploadedFiles(files);
  const scan = saved.length ? await syncMediaLibrary() : null;

  return NextResponse.json({ saved, scan });
}
