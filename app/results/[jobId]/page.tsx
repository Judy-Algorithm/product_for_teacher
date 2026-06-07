import { notFound } from "next/navigation";
import { AnnotatedSheet } from "@/components/results/AnnotatedSheet";
import { ScoreTable } from "@/components/results/ScoreTable";
import { demoJob } from "@/lib/demo-data";
import { getJobFromDatabase } from "@/lib/jobs/repository";

export default async function ResultsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = jobId === demoJob.id ? demoJob : await getJobFromDatabase(jobId);

  if (!job) notFound();

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-4 text-neutral-950">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1fr_420px]">
        <AnnotatedSheet job={job} />
        <ScoreTable job={job} />
      </div>
    </main>
  );
}
