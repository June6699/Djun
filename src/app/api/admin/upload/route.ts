import { NextResponse } from "next/server";
import { cmsUnavailableResponse, isCmsDisabled } from "@/lib/cloudflare-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (isCmsDisabled()) {
    return cmsUnavailableResponse();
  }

  const [{ requireAdminResponse }, { saveUploadedFiles }, { syncMediaLibrary }] = await Promise.all([
    import("@/lib/api"),
    import("@/lib/media"),
    import("@/lib/db")
  ]);
  const { response } = await requireAdminResponse();
  if (response) return response;

  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  const saved = await saveUploadedFiles(files);
  const scan = saved.length ? await syncMediaLibrary() : null;

  return NextResponse.json({ saved, scan });
}
