"use client";

import { useState } from "react";
import { Loader2, ScanLine } from "lucide-react";

interface ProcessJobButtonProps {
  jobId: string;
}

export function ProcessJobButton({ jobId }: ProcessJobButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");

  async function startProcessing() {
    setIsProcessing(true);
    setStatus("正在启动 Python worker...");

    try {
      const response = await fetch(`/api/jobs/${jobId}/process`, { method: "POST" });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "启动失败");
      }

      setStatus("worker 已启动，稍后刷新页面查看 OCR 结果。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "启动失败";
      setStatus(message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        disabled={isProcessing}
        type="button"
        onClick={startProcessing}
      >
        {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}
        启动裁切与 OCR
      </button>
      {status ? <p className="mt-2 text-sm text-neutral-600">{status}</p> : null}
    </div>
  );
}
