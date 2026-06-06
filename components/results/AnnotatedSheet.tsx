import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { GradingJob } from "@/lib/types";

export function AnnotatedSheet({ job }: { job: GradingJob }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <Link href={`/pipeline/${job.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-950">
        <ArrowLeft className="h-4 w-4" />
        返回逐题确认
      </Link>
      <h1 className="text-2xl font-semibold">电子批改图</h1>
      <p className="mt-1 text-sm text-neutral-600">老师确认后，可以按这张图回写纸质试卷或发给家长。</p>
      <div className="relative mt-4 aspect-[3/4] max-h-[760px] overflow-hidden rounded-md bg-neutral-100 paper-shadow">
        <Image src={job.correctedSheetUrl ?? job.studentSheetUrl} alt="电子批改图" fill className="object-contain" priority />
      </div>
    </section>
  );
}
