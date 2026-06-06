"use client";

import { useState } from "react";
import { Check, MessageSquareText, Pencil } from "lucide-react";
import type { QuestionResult, QuestionRubric } from "@/lib/types";
import { TechnicalDetails } from "./TechnicalDetails";

export function GradingPanel({ result, rubric }: { result: QuestionResult; rubric: QuestionRubric }) {
  const [score, setScore] = useState(result.score);
  const [comment, setComment] = useState(result.teacherComment);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-2 text-lg font-semibold">批改结果</h2>
      <div className="space-y-3 text-sm">
        <div className="rounded-md bg-neutral-100 p-3">
          <div className="text-neutral-600">识别答案</div>
          <p className="mt-1 leading-7">{result.recognizedAnswer}</p>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <label className="rounded-md bg-blue-50 p-3 text-blue-900">
            <span className="block text-sm">得分</span>
            <input
              aria-label={`${rubric.label} 得分`}
              className="mt-1 w-full bg-transparent text-3xl font-semibold outline-none"
              min={0}
              max={rubric.fullScore}
              type="number"
              value={score}
              onChange={(event) => setScore(Number(event.target.value))}
            />
          </label>
          <div className="rounded-md bg-neutral-100 p-3">
            <div className="text-neutral-600">原因</div>
            <p className="mt-1 leading-7">{result.reason}</p>
          </div>
        </div>
        <label className="block rounded-md bg-neutral-100 p-3">
          <span className="text-neutral-600">老师评语</span>
          <textarea
            aria-label={`${rubric.label} 老师评语`}
            className="mt-2 min-h-20 w-full resize-none rounded-md border border-neutral-200 bg-white p-2 outline-none focus:border-blue-400"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700"
            onClick={() => setConfirmed(true)}
          >
            <Check className="h-4 w-4" />
            {confirmed ? "已确认" : "确认"}
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 py-2 font-medium hover:bg-neutral-50">
            <Pencil className="h-4 w-4" />
            改分
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 py-2 font-medium hover:bg-neutral-50">
            <MessageSquareText className="h-4 w-4" />
            评语
          </button>
        </div>
        <TechnicalDetails result={result} rubric={rubric} />
      </div>
    </div>
  );
}
