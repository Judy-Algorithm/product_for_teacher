"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useRef, useState } from "react";
import { CheckCircle2, Loader2, ScanLine, Upload } from "lucide-react";
import type { GradingJob } from "@/lib/types";

interface UploadResponse {
  ok: boolean;
  imageUrl?: string;
  fileName?: string;
  storage?: string;
  warning?: string;
  error?: string;
}

export function HardwareImagePanel({ job }: { job: GradingJob }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState(job.studentSheetUrl);
  const [uploadStatus, setUploadStatus] = useState("可以选择本地图片，也可以使用当前 demo 图片。");
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("正在上传图片...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/uploads/paper", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as UploadResponse;

      if (!response.ok || !data.ok || !data.imageUrl) {
        throw new Error(data.error ?? "上传失败");
      }

      setImageSrc(data.imageUrl);
      setUploadStatus(`${data.fileName ?? "图片"} 已上传，存储：${data.storage ?? "backend"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败";
      setUploadStatus(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">拍照试卷</h2>
          <p className="text-sm text-neutral-600">老师可以从本地选择图片，或等待硬件上传。</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          可批改
        </span>
      </div>
      <div className="relative aspect-[3/4] max-h-[680px] overflow-hidden rounded-md bg-neutral-100 paper-shadow">
        <Image src={imageSrc} alt="学生试卷拍照结果" fill className="object-contain" priority />
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
          选择本地试卷图片
        </button>
        <p className="mt-2 text-center text-sm text-neutral-600">{uploadStatus}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-md bg-blue-50 p-2 text-blue-800">已裁正</div>
        <div className="rounded-md bg-emerald-50 p-2 text-emerald-800">字迹清楚</div>
        <div className="rounded-md bg-amber-50 p-2 text-amber-800">待确认</div>
      </div>
      <Link
        href={`/pipeline/${job.id}`}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700"
      >
        <ScanLine className="h-5 w-5" />
        开始逐题确认
      </Link>
    </section>
  );
}
