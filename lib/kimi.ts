export interface KimiGradeInput {
  questionId: string;
  fullScore: number;
  standardAnswer: string;
  rubric: string;
  studentAnswer: string;
  calibration?: string;
}

export interface KimiGradeResult {
  score: number;
  reason: string;
  confidence: number;
  /** Actual token usage reported by Moonshot for this call (undefined if the API didn't report it). */
  usage?: { promptTokens: number; completionTokens: number };
}

export interface KimiVisionGradeInput {
  /** e.g. "第一题" or "q1" — used in the prompt to identify the question */
  questionLabel: string;
  /** Public URL of the answer key / rubric image */
  answerSheetUrl: string;
  /** Public URL of the student's cropped answer region (skipped if data: URL) */
  cropUrl?: string;
  /** OCR-extracted student answer text, used as fallback context */
  recognizedAnswer: string;
}

export interface KimiVisionGradeResult extends KimiGradeResult {
  fullScore: number;
}

interface KimiChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

function readUsage(data: KimiChatResponse): { promptTokens: number; completionTokens: number } | undefined {
  if (!data.usage) return undefined;
  return {
    promptTokens: Number(data.usage.prompt_tokens ?? 0),
    completionTokens: Number(data.usage.completion_tokens ?? 0)
  };
}

export async function gradeWithKimi(input: KimiGradeInput): Promise<KimiGradeResult> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    throw new Error("KIMI_API_KEY is not configured");
  }

  const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.KIMI_MODEL ?? "moonshot-v1-8k",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是小学老师的批改助手。只根据给定评分标准批改，输出严格 JSON：{\"score\": number, \"reason\": string, \"confidence\": number}。reason 不超过 30 个中文字符。"
        },
        {
          role: "user",
          content: JSON.stringify({
            questionId: input.questionId,
            fullScore: input.fullScore,
            standardAnswer: input.standardAnswer,
            rubric: input.rubric,
            studentAnswer: input.studentAnswer,
            calibration: input.calibration ?? ""
          })
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kimi request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as KimiChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Kimi response did not include content");
  }

  const parsed = JSON.parse(content) as Partial<KimiGradeResult>;
  return {
    score: Number(parsed.score ?? 0),
    reason: String(parsed.reason ?? "需要老师复核"),
    confidence: Number(parsed.confidence ?? 0),
    usage: readUsage(data)
  };
}

type VisionContentPart =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

const dataUrlCache = new Map<string, Promise<string | null>>();

/**
 * Moonshot's vision endpoint rejects some remote URLs outright with
 * `invalid_request_error: unsupported image url: https://...` (it appears to
 * allowlist image hosts rather than fetching arbitrary URLs — this affects both
 * Vercel Blob URLs and our own Cloud Run worker's `/crops/...` URLs). The robust
 * fix used by most vision-LLM integrations is to inline the image as a `data:`
 * URI instead of relying on the provider to fetch a remote URL.
 *
 * IMPORTANT: if our own fetch of the URL fails (timeout, the crop not being
 * publicly reachable yet, etc.) we must NOT fall back to returning the raw
 * remote URL — Moonshot would reject it with the very same "unsupported image
 * url" error we're trying to avoid, just one request later. Instead we return
 * `null` so the caller can omit that image and grade from OCR text alone.
 */
async function toInlineImageUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;

  const cached = dataUrlCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) {
        console.warn(`[kimi] toInlineImageUrl: fetch ${url} returned ${response.status}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[kimi] toInlineImageUrl: failed to inline ${url}: ${message}`);
      return null;
    }
  })();

  dataUrlCache.set(url, promise);
  return promise;
}

export async function gradeWithKimiVision(input: KimiVisionGradeInput): Promise<KimiVisionGradeResult> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    throw new Error("KIMI_API_KEY is not configured");
  }

  const visionModel = process.env.KIMI_VISION_MODEL ?? "moonshot-v1-8k-vision-preview";

  // Inline remote URLs as base64 data: URIs — Moonshot rejects some external hosts
  // (e.g. Vercel Blob *and* our own Cloud Run worker's /crops/ URLs) with
  // "unsupported image url" if we pass the URL directly. `toInlineImageUrl`
  // returns null when it can't fetch the image — we must NEVER forward a raw
  // URL in that case (that just reproduces the same provider-side rejection).
  const answerSheetImageUrl = await toInlineImageUrl(input.answerSheetUrl);
  if (!answerSheetImageUrl) {
    throw new Error(
      `无法读取答案卷图片（${input.answerSheetUrl}），Kimi 无法在没有参考答案的情况下批改，已转交人工复核`
    );
  }

  const content: VisionContentPart[] = [
    { type: "image_url", image_url: { url: answerSheetImageUrl } }
  ];

  // Only attach the crop image if we actually managed to inline it — otherwise
  // skip it silently and lean on the OCR'd `recognizedAnswer` text instead, so
  // one un-fetchable crop doesn't sink the whole grading call.
  let hasCropImage = false;
  if (input.cropUrl) {
    const cropImageUrl = await toInlineImageUrl(input.cropUrl);
    if (cropImageUrl) {
      content.push({ type: "image_url", image_url: { url: cropImageUrl } });
      hasCropImage = true;
    }
  }

  const answerHint = input.recognizedAnswer.trim()
    ? `学生OCR识别答案："${input.recognizedAnswer}"`
    : hasCropImage
      ? "学生答案见第二张图片"
      : "未能获取学生作答图片，也没有 OCR 文本——请基于已知信息谨慎评分，并在 reason 中说明信息不足。";

  content.push({
    type: "text",
    text: [
      `第一张图是答案评分标准。${hasCropImage ? "第二张图是该学生的作答图片。" : ""}`,
      `请找到【${input.questionLabel}】的满分分值和评分标准，然后批改该题。`,
      answerHint,
      `输出严格JSON：{"score": number, "fullScore": number, "reason": string, "confidence": number}。`,
      `reason不超过30个中文字符。score不得超过fullScore。`
    ].join("\n")
  });

  const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: visionModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是小学老师的批改助手。根据答案评分标准图片批改学生答案，输出严格JSON：{\"score\": number, \"fullScore\": number, \"reason\": string, \"confidence\": number}。reason不超过30个中文字符。"
        },
        { role: "user", content }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kimi Vision request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as KimiChatResponse;
  const responseContent = data.choices?.[0]?.message?.content;
  if (!responseContent) {
    throw new Error("Kimi Vision response did not include content");
  }

  const parsed = JSON.parse(responseContent) as Partial<KimiVisionGradeResult>;
  const fullScore = Number(parsed.fullScore ?? 10);
  const score = Math.min(Math.max(Number(parsed.score ?? 0), 0), fullScore);
  return {
    score,
    fullScore,
    reason: String(parsed.reason ?? "需要老师复核"),
    confidence: Number(parsed.confidence ?? 0),
    usage: readUsage(data)
  };
}
