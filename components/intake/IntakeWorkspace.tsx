import { demoJob } from "@/lib/demo-data";
import { AnswerKeyPanel } from "./AnswerKeyPanel";
import { HardwareImagePanel } from "./HardwareImagePanel";

export function IntakeWorkspace() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-neutral-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <HardwareImagePanel job={demoJob} />
          <AnswerKeyPanel />
        </div>
      </div>
    </main>
  );
}
