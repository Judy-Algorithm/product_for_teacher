import { QuestionReview } from "@/components/pipeline/QuestionReview";
import { demoJob } from "@/lib/demo-data";

export default function PipelinePage() {
  return <QuestionReview job={demoJob} />;
}
