"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { ERROR_TYPES, type ErrorType, type QuestionResult, type QuestionRubric } from "@/lib/types";
import { TechnicalDetails } from "./TechnicalDetails";

export function GradingPanel({
  result,
  rubric,
  jobId,
}: {
  result: QuestionResult;
  rubric: QuestionRubric;
  jobId: string;
}) {
  const [score, setScore] = useState(result.score);
  const [reason, setReason] = useState(result.reason);
  const [draftScore, setDraftScore] = useState(result.score);
  const [draftReason, setDraftReason] = useState(result.reason);
  const [errorType, setErrorType] = useState<ErrorType | undefined>(result.errorType);
  const [draftErrorType, setDraftErrorType] = useState<ErrorType | "">(result.errorType ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [reviewStatus, setReviewStatus] = useState(result.reviewStatus ?? "auto_accepted");

  function startEditing() {
    setDraftScore(score);
    setDraftReason(reason);
    setDraftErrorType(errorType ?? "");
    setSaveError("");
    setIsEditing(true);
  }

  async function confirmEdit() {
    setIsSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/results`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: result.questionId,
          score: draftScore,
          reason: draftReason,
          errorType: draftErrorType || undefined,
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      setScore(draftScore);
      setReason(draftReason);
      setErrorType(draftErrorType || undefined);
      setReviewStatus("teacher_modified");
      setIsEditing(false);
    } catch {
      setSaveError("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  }

  function cancelEdit() {
    setDraftScore(score);
    setDraftReason(reason);
    setIsEditing(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">批改结果</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm ${
            reviewStatus === "teacher_modified"
              ? "bg-amber-50 text-amber-700"
              : reviewStatus === "needs_rescan"
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {reviewStatus === "teacher_modified"
            ? "老师已修改"
            : reviewStatus === "needs_rescan"
              ? "需重拍"
              : "默认正确"}
        </span>
      </div>
      <div className="space-y-3 text-sm">
        <div className="rounded-md bg-neutral-100 p-3">
          <div className="text-neutral-600">识别答案</div>
          <p className="mt-1 leading-7">{result.recognizedAnswer || "（未识别到文字）"}</p>
        </div>
        {result.reconstruction && result.reconstruction.steps.length > 0 ? (
          <div className="rounded-md border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-600">
                AI 重组复原 <span className="text-xs text-neutral-400">（请对照左侧原图逐条核对，每条标注了它在图中的大致位置）</span>
              </span>
              {result.route === "teacher_review" ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">建议重点核对</span>
              ) : null}
            </div>
            <ol className="mt-2 space-y-1.5 leading-6">
              {result.reconstruction.steps.map((step, index) => (
                <li key={index} className="flex gap-2">
                  <span className="shrink-0 text-neutral-400">{index + 1}.</span>
                  <span>
                    {step.text}
                    {step.imageRegion ? (
                      <span className="ml-1.5 text-xs text-neutral-400">（{step.imageRegion}）</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <div className="rounded-md bg-blue-50 p-3 text-blue-900">
            <span className="block text-sm">得分</span>
            <p className="mt-1 text-3xl font-semibold">{score}</p>
          </div>
          <div className="rounded-md bg-neutral-100 p-3">
            <div className="text-neutral-600">原因</div>
            <p className="mt-1 leading-7">{reason}</p>
            {errorType && errorType !== "无错误" ? (
              <p className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                判错原因：{errorType}
              </p>
            ) : null}
          </div>
        </div>
        {isEditing ? (
          <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3">
            <label className="block">
              <span className="text-blue-900">修改得分</span>
              <input
                aria-label={`${rubric.label} 修改得分`}
                className="mt-2 w-full rounded-md border border-blue-200 bg-white p-2 outline-none focus:border-blue-500"
                min={0}
                max={rubric.fullScore || 100}
                type="number"
                value={draftScore}
                onChange={(e) => setDraftScore(Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="text-blue-900">修改原因</span>
              <textarea
                aria-label={`${rubric.label} 修改原因`}
                className="mt-2 min-h-20 w-full resize-none rounded-md border border-blue-200 bg-white p-2 outline-none focus:border-blue-500"
                value={draftReason}
                onChange={(e) => setDraftReason(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-blue-900">标记 AI 判错原因（用于错题统计与后续校准）</span>
              <select
                aria-label={`${rubric.label} 标记判错原因`}
                className="mt-2 w-full rounded-md border border-blue-200 bg-white p-2 outline-none focus:border-blue-500"
                value={draftErrorType}
                onChange={(e) => setDraftErrorType(e.target.value as ErrorType | "")}
              >
                <option value="">不标记</option>
                {ERROR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={isSaving}
                onClick={confirmEdit}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                确认修改
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 font-medium hover:bg-neutral-50 disabled:opacity-50"
                disabled={isSaving}
                onClick={cancelEdit}
              >
                <X className="h-4 w-4" />
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 py-3 font-medium hover:bg-neutral-50"
            onClick={startEditing}
          >
            <Pencil className="h-5 w-5" />
            修改
          </button>
        )}
        <TechnicalDetails result={result} rubric={rubric} />
      </div>
    </div>
  );
}
