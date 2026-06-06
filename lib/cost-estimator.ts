import type { QuestionResult } from "./types";

export function estimateJobTokens(results: QuestionResult[]) {
  return results.reduce(
    (total, result) => ({
      input: total.input + result.tokenEstimate.input,
      output: total.output + result.tokenEstimate.output,
      savedByRouting: total.savedByRouting + result.tokenEstimate.savedByRouting
    }),
    { input: 0, output: 0, savedByRouting: 0 }
  );
}
