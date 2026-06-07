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
    confidence: Number(parsed.confidence ?? 0)
  };
}

type VisionContentPart =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

const dataUrlCache = new Map<string, Promise<string>>();

/**
 * Moonshot's vision endpoint rejects some remote URLs outright with
 * `invalid_request_error: unsupported image url: https://...vercel-storage.com/...`
 * (it appears to allowlist image hosts rather than fetching arbitrary URLs). The
 * robust fix used by most vision-LLM integrations is to inline the image as a
 * `data:` URI instead of relying on the provider to fetch a remote URL. We fetch the
 * image ourselves and convert it; if that fails for any reason we fall back to the
 * original URL so we at least try.
 */
async function toInlineImageUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;

  const cached = dataUrlCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) return url;
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return `data:${contentType};base64,${base64}`;
    } catch {
      return url;
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
  // (e.g. Vercel Blob) with "unsupported image url" if we pass the URL directly.
  const answerSheetImageUrl = await toInlineImageUrl(input.answerSheetUrl);

  const content: VisionContentPart[] = [
    { type: "image_url", image_url: { url: answerSheetImageUrl } }
  ];

  const hasCrop = Boolean(input.cropUrl);
  if (hasCrop) {
    const cropImageUrl = await toInlineImageUrl(input.cropUrl!);
    content.push({ type: "image_url", image_url: { url: cropImageUrl } });
  }

  const answerHint = input.recognizedAnswer.trim()
    ? `学生OCR识别答案："${input.recognizedAnswer}"`
    : "学生答案见第二张图片";

  content.push({
    type: "text",
    text: [
      `第一张图是答案评分标准。${hasCrop ? "第二张图是该学生的作答图片。" : ""}`,
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
    confidence: Number(parsed.confidence ?? 0)
  };
}
