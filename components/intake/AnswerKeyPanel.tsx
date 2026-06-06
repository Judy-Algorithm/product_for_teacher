import Image from "next/image";
import type { GradingJob } from "@/lib/types";

export function AnswerKeyPanel({ job }: { job: GradingJob }) {
  const visibleScore = job.rubrics.reduce((sum, rubric) => sum + rubric.fullScore, 0);

  return (
    <aside className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">答案与评分标准</h2>
          <p className="text-sm text-neutral-600">当前图片覆盖第 1-4 题，共 {visibleScore} 分。</p>
        </div>
      </div>
      <div className="relative aspect-[16/23] overflow-hidden rounded-md border border-neutral-200 bg-white">
        <Image src={job.answerSheetUrl} alt="答案评分标准" fill className="object-contain" />
      </div>
      <div className="mt-4 space-y-2">
        {job.rubrics.map((rubric) => (
          <div key={rubric.questionId} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm">
            <span className="font-medium">{rubric.label}</span>
            <span className="text-neutral-600">{rubric.fullScore} 分</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
