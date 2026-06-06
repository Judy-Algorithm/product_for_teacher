"use client";

import { useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { AnswerKeyPanel } from "./AnswerKeyPanel";
import { HardwareImagePanel } from "./HardwareImagePanel";

interface CreateJobResponse {
  ok: boolean;
  jobId?: string;
  next?: string;
  error?: string;
}

export function IntakeWorkspace() {
  const [studentSheetUrl, setStudentSheetUrl] = useState("");
  const [answerSheetUrl, setAnswerSheetUrl] = useState("");
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [jobStatus, setJobStatus] = useState("");

  async function createJob() {
    setIsCreatingJob(true);
    setJobStatus("正在创建批改任务...");

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentSheetUrl, answerSheetUrl })
      });
      const data = (await response.json()) as CreateJobResponse;

      if (!response.ok || !data.ok || !data.next) {
        throw new Error(data.error ?? "创建任务失败");
      }

      setJobStatus(`任务已创建：${data.jobId}`);
      window.location.href = data.next;
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建任务失败";
      setJobStatus(message);
    } finally {
      setIsCreatingJob(false);
    }
  }

  const canCreateJob = Boolean(studentSheetUrl && answerSheetUrl) && !isCreatingJob;

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-neutral-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <HardwareImagePanel onUploaded={setStudentSheetUrl} />
          <AnswerKeyPanel onUploaded={setAnswerSheetUrl} />
        </div>
        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">创建批改任务</h2>
              <p className="mt-1 text-sm text-neutral-600">两张图片上传完成后，系统会把 Blob URL 保存到 Neon 数据库。</p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
              disabled={!canCreateJob}
              type="button"
              onClick={createJob}
            >
              {isCreatingJob ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}
              创建任务并进入确认
            </button>
          </div>
          {jobStatus ? <p className="mt-3 text-sm text-neutral-600">{jobStatus}</p> : null}
        </section>
      </div>
    </main>
  );
}
