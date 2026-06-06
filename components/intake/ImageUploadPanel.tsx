"use client";

import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { ChangeEvent, ReactNode, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Upload } from "lucide-react";

interface ImageUploadPanelProps {
  title: string;
  description: string;
  alt: string;
  buttonLabel: string;
  emptyLabel: string;
  aspectClassName: string;
  priority?: boolean;
  footer?: ReactNode;
  onUploaded?: (imageUrl: string) => void;
}

export function ImageUploadPanel({
  title,
  description,
  alt,
  buttonLabel,
  emptyLabel,
  aspectClassName,
  priority = false,
  footer,
  onUploaded
}: ImageUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  function safeFileName(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "paper-image";
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("正在上传图片...");

    try {
      const blob = await upload(`papers/${Date.now()}-${safeFileName(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/client"
      });

      setImageSrc(blob.url);
      setUploadStatus(`${file.name} 已上传，存储：vercel-blob`);
      onUploaded?.(blob.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败";
      setUploadStatus(message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-neutral-600">{description}</p>
        </div>
        {imageSrc ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            已上传
          </span>
        ) : null}
      </div>

      <div className={`relative max-h-[680px] overflow-hidden rounded-md bg-neutral-100 paper-shadow ${aspectClassName}`}>
        {imageSrc ? (
          <Image src={imageSrc} alt={alt} fill className="object-contain" priority={priority} />
        ) : (
          <button
            className="flex h-full w-full flex-col items-center justify-center gap-3 border border-dashed border-neutral-300 text-neutral-500 hover:bg-neutral-50"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-10 w-10" />
            <span className="text-sm font-medium">{emptyLabel}</span>
          </button>
        )}
      </div>

      <div className="mt-4 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3">
        <input ref={inputRef} className="hidden" type="file" accept="image/*" onChange={handleFileChange} />
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-3 font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isUploading}
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {buttonLabel}
        </button>
        {uploadStatus ? <p className="mt-2 text-center text-sm text-neutral-600">{uploadStatus}</p> : null}
      </div>

      {footer}
    </section>
  );
}
