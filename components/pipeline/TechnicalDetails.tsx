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
        {result.llmConfidence !== undefined ? (
          <p>Kimi 批改置信度：{Math.round(result.llmConfidence * 100)}%（低于阈值会自动转交老师复核，而不是静默采信）</p>
        ) : null}
        {result.reconstruction ? (
          <p>
            AI 转写置信度：{Math.round(result.reconstruction.transcriptionConfidence * 100)}%
            {result.reconstructionDivergence !== undefined ? (
              <span> · 与 OCR 独立识别结果的差异度：{Math.round(result.reconstructionDivergence * 100)}%（数值越高，越可能存在转写幻觉，建议对照原图核实）</span>
            ) : null}
          </p>
        ) : null}
        {result.pointChecks && result.pointChecks.length > 0 ? (
          <div>
            <p>逐点核对依据（来自 AI 重组复原内容的引用，而非凭空判断）：</p>
            <ul className="ml-4 list-disc space-y-0.5">
              {result.pointChecks.map((check) => (
                <li key={check.pointId}>
                  {check.pointId}：{check.satisfied ? "已满足" : "未满足"} —— {check.evidence || "（未提供依据）"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p>
          Token：输入 {result.tokenEstimate.input}，输出 {result.tokenEstimate.output}，节省 {result.tokenEstimate.savedByRouting}
        </p>
      </div>
    </details>
  );
}
