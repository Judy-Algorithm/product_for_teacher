import type { QuestionResult, QuestionRubric } from "@/lib/types";

export function TechnicalDetails({ result, rubric }: { result: QuestionResult; rubric: QuestionRubric }) {
  return (
    <details className="rounded-md border border-neutral-200 p-3">
      <summary className="cursor-pointer text-sm text-neutral-600">技术详情</summary>
      <div className="mt-3 space-y-1 text-sm text-neutral-600">
        <p>标准答案：{rubric.standardAnswer}</p>
        <p>评分标准：{rubric.standardSummary}</p>
        <p>判分方式：{result.route === "rule" ? "规则判分" : result.route === "llm" ? "AI 辅助" : "老师复核"}</p>
        <p>识别置信度：{Math.round(result.ocrConfidence * 100)}%</p>
        <p>
          Token：输入 {result.tokenEstimate.input}，输出 {result.tokenEstimate.output}，节省 {result.tokenEstimate.savedByRouting}
        </p>
      </div>
    </details>
  );
}
