import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ source: "teacher-intake" })
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log("Blob upload completed", blob.url);
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown client upload error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
