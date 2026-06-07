import Image from "next/image";
import type { QuestionResult, QuestionRubric } from "@/lib/types";

export function QuestionCropPanel({ result, rubric }: { result: QuestionResult; rubric: QuestionRubric }) {
  const needsRescan = result.cropConfidence === "low" || result.reviewStatus === "needs_rescan";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{rubric.label}</h2>
        <span className={`rounded-full px-3 py-1 text-sm ${needsRescan ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-600"}`}>
          {needsRescan ? "建议重新拍照" : `${rubric.fullScore} 分`}
        </span>
      </div>
      <div className="relative h-72 overflow-hidden rounded-md bg-neutral-100 sm:h-80 lg:h-[360px]">
        {/*
          object-contain (not object-cover): teachers need to see the FULL crop region
          to judge whether OpenCV's question-box detection is accurate. object-cover
          was silently clipping the left/right edges of wide crops to fill the box,
          which made correctly-cropped questions look mis-cropped even when the
          underlying box was fine.
        */}
        <Image src={result.cropUrl} alt={`${rubric.label} 答题区域`} fill className="object-contain" />
      </div>
    </div>
  );
}
