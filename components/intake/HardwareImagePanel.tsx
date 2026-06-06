import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ScanLine } from "lucide-react";
import type { GradingJob } from "@/lib/types";

export function HardwareImagePanel({ job }: { job: GradingJob }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">拍照试卷</h2>
          <p className="text-sm text-neutral-600">硬件上传后，老师只需要确认图片清楚。</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          可批改
        </span>
      </div>
      <div className="relative aspect-[3/4] max-h-[680px] overflow-hidden rounded-md bg-neutral-100 paper-shadow">
        <Image src={job.studentSheetUrl} alt="学生试卷拍照结果" fill className="object-contain" priority />
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
