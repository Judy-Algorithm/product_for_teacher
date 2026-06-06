import { demoJob } from "@/lib/demo-data";
import { AnswerKeyPanel } from "./AnswerKeyPanel";
import { HardwareImagePanel } from "./HardwareImagePanel";

export function IntakeWorkspace() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-neutral-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4">
        <header className="flex flex-col justify-between gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-blue-700">老师批改助手 Demo</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">{demoJob.title}</h1>
          </div>
          <div className="rounded-md bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm">
            当前学生：{demoJob.studentName}
          </div>
        </header>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <HardwareImagePanel job={demoJob} />
          <AnswerKeyPanel job={demoJob} />
        </div>
      </div>
    </main>
  );
}
