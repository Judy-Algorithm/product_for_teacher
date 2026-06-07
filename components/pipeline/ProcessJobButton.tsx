"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanLine } from "lucide-react";

interface ProcessJobButtonProps {
  jobId: string;
  shouldPoll: boolean;
}

export function ProcessJobButton({ jobId, shouldPoll }: ProcessJobButtonProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPolling, setIsPolling] = useState(shouldPoll);
  const [status, setStatus] = useState(shouldPoll ? "正在等待 OCR 结果..." : "");

  useEffect(() => {
    if (!shouldPoll && !isPolling) return;

    const interval = window.setInterval(() => {
      router.refresh();
    }, 4000);

    return () => window.clearInterval(interval);
  }, [isPolling, router, shouldPoll]);

  async function startProcessing() {
    setIsProcessing(true);
    setStatus("正在裁切和 OCR，通常需要 1-3 分钟，请先不要关闭页面...");

    try {
      const response = await fetch(`/api/jobs/${jobId}/process`, { method: "POST" });
      const responseText = await response.text();
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = responseText ? (JSON.parse(responseText) as { ok?: boolean; error?: string }) : {};
      } catch {
        const preview = responseText.length > 160 ? `${responseText.slice(0, 160)}...` : responseText;
        data = { ok: false, error: preview ? `服务返回非 JSON：${preview}` : `启动失败：${response.status}` };
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "启动失败");
      }

      setStatus("已提交给 OCR 服务，正在后台裁切和识别（通常 1-3 分钟），完成后会自动刷新...");
      setIsPolling(true);
      router.refresh();
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
