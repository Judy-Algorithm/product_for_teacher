import Link from "next/link";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import type { GradingJob } from "@/lib/types";
import { GradingPanel } from "./GradingPanel";
import { QuestionCropPanel } from "./QuestionCropPanel";

export function QuestionReview({ job }: { job: GradingJob }) {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-4 text-neutral-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-col justify-between gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <Link href="/" className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-950">
              <ArrowLeft className="h-4 w-4" />
              返回拍照页
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">逐题确认</h1>
            <p className="mt-1 text-sm text-neutral-600">看截图、看分数，不对就改。其他都交给系统。</p>
          </div>
          <Link href={`/results/${job.id}`} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">
            <FileCheck2 className="h-5 w-5" />
            查看总分
          </Link>
        </div>
        <div className="space-y-4">
          {job.results.map((result) => {
            const rubric = job.rubrics.find((item) => item.questionId === result.questionId);
            if (!rubric) return null;
            return (
              <section key={result.questionId} className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_420px]">
                <QuestionCropPanel result={result} rubric={rubric} />
                <GradingPanel result={result} rubric={rubric} />
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
