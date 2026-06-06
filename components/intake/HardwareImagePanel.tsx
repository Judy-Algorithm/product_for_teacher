import Link from "next/link";
import { ScanLine } from "lucide-react";
import type { GradingJob } from "@/lib/types";
import { ImageUploadPanel } from "./ImageUploadPanel";

export function HardwareImagePanel({ job }: { job: GradingJob }) {
  return (
    <ImageUploadPanel
      title="上传学生试卷"
      description="从本地选择学生作答后的试卷图片。"
      alt="学生试卷图片"
      buttonLabel="选择本地试卷图片"
      emptyLabel="上传学生试卷图片"
      aspectClassName="aspect-[3/4]"
      priority
      footer={
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md bg-blue-50 p-2 text-blue-800">待裁切</div>
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-800">待 OCR</div>
            <div className="rounded-md bg-amber-50 p-2 text-amber-800">待评分</div>
          </div>
          <Link
            href={`/pipeline/${job.id}`}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700"
          >
            <ScanLine className="h-5 w-5" />
            开始逐题确认
          </Link>
        </>
      }
    />
  );
}
