import { Download, FileSpreadsheet } from "lucide-react";
import type { GradingJob } from "@/lib/types";
import { estimateJobTokens } from "@/lib/cost-estimator";

export function ScoreTable({ job }: { job: GradingJob }) {
  const tokenTotal = estimateJobTokens(job.results);
  const visibleScore = job.results.reduce((sum, result) => sum + result.score, 0);
  const visibleFullScore = job.rubrics.reduce((sum, rubric) => sum + rubric.fullScore, 0);
  const projectedScore = Math.round((visibleScore / visibleFullScore) * job.totalScore);

  return (
    <aside className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">成绩</h2>
      <p className="mt-1 text-sm text-neutral-600">当前 demo 只展示图片中第 1-4 题。</p>
      <div className="mt-4 rounded-md bg-blue-50 p-4 text-blue-950">
        <div className="text-sm">已展示题目</div>
        <div className="mt-1 text-4xl font-semibold">
          {visibleScore}/{visibleFullScore}
        </div>
      </div>
      <div className="mt-3 rounded-md bg-emerald-50 p-4 text-emerald-950">
        <div className="text-sm">按当前部分折算</div>
        <div className="mt-1 text-3xl font-semibold">{projectedScore}/100</div>
      </div>
      <div className="mt-4 space-y-2">
        {job.results.map((result) => {
          const rubric = job.rubrics.find((item) => item.questionId === result.questionId);
          return (
            <div key={result.questionId} className="flex items-center justify-between border-b border-neutral-100 py-2 text-sm">
              <span>{rubric?.label ?? result.questionId}</span>
              <span className="font-medium">
                {result.score}/{rubric?.fullScore ?? 0}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-2">
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">
          <Download className="h-5 w-5" />
          导出批改图
        </button>
        <button className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 py-3 font-medium hover:bg-neutral-50">
          <FileSpreadsheet className="h-5 w-5" />
          导出成绩表
        </button>
      </div>
      <details className="mt-4 rounded-md border border-neutral-200 p-3 text-sm">
        <summary className="cursor-pointer text-neutral-600">技术详情</summary>
        <div className="mt-2 text-neutral-600">
          <p>输入 Token：{tokenTotal.input}</p>
          <p>输出 Token：{tokenTotal.output}</p>
          <p>规则分流节省：{tokenTotal.savedByRouting}</p>
        </div>
      </details>
    </aside>
  );
}
