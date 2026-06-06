import { QuestionReview } from "@/components/pipeline/QuestionReview";
import { demoJob } from "@/lib/demo-data";
import { getJobFromDatabase } from "@/lib/jobs/repository";

export default async function PipelinePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = jobId === demoJob.id ? demoJob : await getJobFromDatabase(jobId);

  return <QuestionReview job={job ?? demoJob} />;
}
