"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import type { QuestionRubric } from "@/lib/types";

interface RubricDraft {
  questionId: string;
  label: string;
  fullScore: number;
  standardAnswer: string;
  standardSummary: string;
}

const LABELS = [
  "第一题", "第二题", "第三题", "第四题", "第五题", "第六题",
  "第七题", "第八题", "第九题", "第十题", "第十一题", "第十二题",
];

function newRow(index: number): RubricDraft {
  return {
    questionId: `q${index + 1}`,
    label: LABELS[index] ?? `第${index + 1}题`,
    fullScore: 10,
    standardAnswer: "",
    standardSummary: "",
  };
}

export function RubricEditor({ jobId }: { jobId: string }) {
  const [rows, setRows] = useState<RubricDraft[]>([newRow(0)]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function addRow() {
    setRows((prev) => [...prev, newRow(prev.length)]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function update(index: number, field: keyof RubricDraft, value: string | number) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const rubrics: QuestionRubric[] = rows.map((r) => ({
        questionId: r.questionId,
        label: r.label,
        type: "short_answer" as const,
        fullScore: r.fullScore,
        standardAnswer: r.standardAnswer,
        standardSummary: r.standardSummary || r.standardAnswer,
        points: [],
        deductionRules: [],
      }));
      const res = await fetch(`/api/jobs/${jobId}/rubrics`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rubrics }),
      });
      if (!res.ok) throw new Error("保存失败");
      setSaved(true);
    } catch {
      setError("保存评分标准失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">评分标准（可选，不填则由 Kimi 自动从答案图提取）</h3>
        <button
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={saving}
          onClick={save}
        >
          <Save className="h-4 w-4" />
          {saving ? "保存中…" : saved ? "已保存 ✓" : "保存评分标准"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">题号</th>
              <th className="px-3 py-2">满分</th>
              <th className="px-3 py-2">标准答案</th>
              <th className="px-3 py-2">评分要点</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.questionId} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium text-neutral-700">{row.label}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded-md border border-neutral-200 p-1 text-center outline-none focus:border-blue-400"
                    value={row.fullScore}
                    onChange={(e) => update(i, "fullScore", Number(e.target.value))}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    placeholder="请填写标准答案"
                    className="w-full rounded-md border border-neutral-200 p-1 outline-none focus:border-blue-400"
                    value={row.standardAnswer}
                    onChange={(e) => update(i, "standardAnswer", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    placeholder="可选，如：写对字形得满分"
                    className="w-full rounded-md border border-neutral-200 p-1 outline-none focus:border-blue-400"
                    value={row.standardSummary}
                    onChange={(e) => update(i, "standardSummary", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    className="text-neutral-400 hover:text-red-500"
                    onClick={() => removeRow(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        onClick={addRow}
      >
        <Plus className="h-4 w-4" />
        添加题目
      </button>
    </div>
  );
}
