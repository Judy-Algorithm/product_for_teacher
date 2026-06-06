import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const maxFileSize = 10 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "paper-image";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "Only image files are supported" }, { status: 400 });
  }

  if (file.size > maxFileSize) {
    return NextResponse.json({ ok: false, error: "Image must be 10MB or smaller" }, { status: 413 });
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`papers/${Date.now()}-${safeFileName(file.name)}`, file, {
      access: "public",
      addRandomSuffix: true
    });

    return NextResponse.json({
      ok: true,
      imageUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
      storage: "vercel-blob"
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

  return NextResponse.json({
    ok: true,
    imageUrl,
    fileName: file.name,
    fileSize: file.size,
    storage: "inline-dev",
    warning: "BLOB_READ_WRITE_TOKEN is not configured; using inline preview for local development."
  });
}
