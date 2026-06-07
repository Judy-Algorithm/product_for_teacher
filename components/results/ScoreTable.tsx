"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import type { GradingJob } from "@/lib/types";
import { estimateJobTokens } from "@/lib/cost-estimator";

export function ScoreTable({ job }: { job: GradingJob }) {
  const tokenTotal = estimateJobTokens(job.results);
  const totalScore = job.results.reduce((sum, r) => sum + r.score, 0);

  function exportCsv() {
    window.open(`/api/jobs/${job.id}/results?format=csv`, "_blank");
  }

  return (
    <aside className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">成绩汇总</h2>

      {/* Total score */}
      <div className="mt-4 rounded-md bg-blue-50 p-4 text-blue-950">
        <div className="text-sm">总分</div>
        <div className="mt-1 text-4xl font-semibold">{totalScore}</div>
      </div>

      {/* Per-question breakdown */}
      <div className="mt-4 space-y-1">
        {job.results.map((result) => {
          const rubric = job.rubrics.find((r) => r.questionId === result.questionId);
          const label = rubric?.label ?? result.questionId;
          const full = rubric?.fullScore;
          const modified = result.reviewStatus === "teacher_modified";
          return (
            <div
              key={result.questionId}
              className="flex items-center justify-between border-b border-neutral-100 py-2 text-sm"
            >
              <span className={modified ? "text-amber-700" : ""}>
                {label}
                {modified ? " ✏️" : ""}
              </span>
              <span className="font-medium">
                {result.score}
                {full !== undefined ? `/${full}` : ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* Export buttons */}
      <div className="mt-4 grid gap-2">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 py-3 font-medium hover:bg-neutral-50"
          onClick={exportCsv}
        >
          <FileSpreadsheet className="h-5 w-5" />
          导出成绩表 (CSV)
        </button>
        <a
          href={job.correctedSheetUrl ?? job.studentSheetUrl}
          download={`corrected-${job.id.slice(0, 8)}.jpg`}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
        >
          <Download className="h-5 w-5" />
          下载批改图
        </a>
      </div>

      <details className="mt-4 rounded-md border border-neutral-200 p-3 text-sm">
        <summary className="cursor-pointer text-neutral-600">技术详情</summary>
        <div className="mt-2 space-y-1 text-neutral-600">
          <p>输入 Token：{tokenTotal.input}</p>
          <p>输出 Token：{tokenTotal.output}</p>
          <p>规则分流节省：{tokenTotal.savedByRouting}</p>
        </div>
      </details>
    </aside>
  );
}
