"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import type { QuestionResult, QuestionRubric } from "@/lib/types";
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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [reviewStatus, setReviewStatus] = useState(result.reviewStatus ?? "auto_accepted");

  function startEditing() {
    setDraftScore(score);
    setDraftReason(reason);
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
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      setScore(draftScore);
      setReason(draftReason);
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
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <div className="rounded-md bg-blue-50 p-3 text-blue-900">
            <span className="block text-sm">得分</span>
            <p className="mt-1 text-3xl font-semibold">{score}</p>
          </div>
          <div className="rounded-md bg-neutral-100 p-3">
            <div className="text-neutral-600">原因</div>
            <p className="mt-1 leading-7">{reason}</p>
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
