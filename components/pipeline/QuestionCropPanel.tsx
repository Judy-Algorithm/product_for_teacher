import Image from "next/image";
import type { QuestionResult, QuestionRubric } from "@/lib/types";

export function QuestionCropPanel({ result, rubric }: { result: QuestionResult; rubric: QuestionRubric }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{rubric.label}</h2>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-600">{rubric.fullScore} 分</span>
      </div>
      <div className="relative aspect-[16/8] overflow-hidden rounded-md bg-neutral-100">
        <Image src={result.cropUrl} alt={`${rubric.label} 答题区域`} fill className="object-contain" />
      </div>
    </div>
  );
}
