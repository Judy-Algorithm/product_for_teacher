import { AnnotatedSheet } from "@/components/results/AnnotatedSheet";
import { ScoreTable } from "@/components/results/ScoreTable";
import { demoJob } from "@/lib/demo-data";

export default function ResultsPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-4 text-neutral-950">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1fr_420px]">
        <AnnotatedSheet job={demoJob} />
        <ScoreTable job={demoJob} />
      </div>
    </main>
  );
}
