import type { PointCheck, ReconstructionStep } from "./types";

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
  /**
   * Kimi's "重组复原" (reconstruction): a grounded transcription/reorganization of
   * the handwritten answer, with each step tagged to a region of the source image.
   * This is the highest-hallucination-risk step of the whole pipeline — surfacing
   * it (rather than hiding it inside an opaque score) lets teachers audit it
   * against the crop image, and lets us cross-check it against independent OCR
   * (see `estimateReconstructionDivergence`).
   */
  reconstruction?: {
    steps: ReconstructionStep[];
    transcriptionConfidence: number;
  };
  /** Per-rubric-point grading evidence, each citing back to `reconstruction` rather than being re-derived from scratch. */
  pointChecks?: PointCheck[];
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

  // Three-stage prompt: 重组复原 (grounded reconstruction) → 逐点核对 (cite evidence
  // from the reconstruction, not from imagination) → 打分 (score must follow from
  // the point-checks). This exists specifically to contain hallucination in the
  // highest-risk step — free-form "read and grade" lets the model silently invent
  // plausible-looking solution steps that aren't actually on the page. Forcing it
  // to (a) commit to a grounded transcription first, (b) cite *that* transcription
  // (not the image again) when checking each scoring point, and (c) derive the
  // score from those citations, makes fabrication both harder to do and far easier
  // for a teacher to catch by comparing `reconstruction.steps` to the crop image.
  content.push({
    type: "text",
    text: [
      `第一张图是答案评分标准。${hasCropImage ? "第二张图是该学生的作答图片。" : ""}`,
      `请按以下三个步骤批改【${input.questionLabel}】，并以严格 JSON 输出：`,
      ``,
      `【步骤一·重组复原】仔细查看学生作答图片，只转写图片中实际可见的内容，按你判断的正确逻辑顺序重新组织成连贯的解答步骤（处理箭头/插入/划掉重写时按"作者最终想表达的逻辑"组织）。`,
      `- 禁止猜测或补全图片中没有的内容；字迹无法辨认就写"[无法辨认]"，绝不杜撰。`,
      `- 给每个步骤标注它在图片中的大致位置（如"左上角第一行"、"中部偏右"），方便老师对照原图核对。`,
      `- 给出 transcriptionConfidence（0~1）：字迹工整清晰给高值，潦草/涂改/模糊难辨必须给低值，不要每次都给同一个数。`,
      answerHint,
      ``,
      `【步骤二·逐点核对】依据第一张图中的评分标准，自行列出该题的得分点（编号 point1、point2…），然后只对照"步骤一"重组出的内容逐条判断每个得分点是否满足：`,
      `- 每条都要在 evidence 中引用"步骤一"里具体是哪一步/哪句话作为依据；如果重组内容中找不到支持该点的证据，必须写"未找到依据"，不得假设学生写了重组之外的内容。`,
      ``,
      `【步骤三·打分】根据"步骤二"的核对结果给出最终得分——score 必须与逐点核对结果一致，不得凭整体印象打分。reason 不超过30个中文字符；confidence 是你对"这个最终得分是否正确"的整体置信度（0~1，同样不要每次都给同一个数）。`,
      ``,
      `输出严格JSON：{"reconstruction": {"steps": [{"text": string, "imageRegion": string}], "transcriptionConfidence": number}, "pointChecks": [{"pointId": string, "satisfied": boolean, "evidence": string}], "score": number, "fullScore": number, "reason": string, "confidence": number}`,
      `score不得超过fullScore。`
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
            "你是小学老师的批改助手。批改前必须先把学生手写作答图片「重组复原」成连贯文字——只转写图片中真实存在的内容，看不清就写[无法辨认]，绝不猜测补全；再仅依据这份重组内容逐条核对评分点并引用具体依据；最后据此打分。输出严格JSON：{\"reconstruction\":{\"steps\":[{\"text\":string,\"imageRegion\":string}],\"transcriptionConfidence\":number},\"pointChecks\":[{\"pointId\":string,\"satisfied\":boolean,\"evidence\":string}],\"score\":number,\"fullScore\":number,\"reason\":string,\"confidence\":number}。reason不超过30个中文字符。"
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

  const parsed = JSON.parse(responseContent) as Record<string, unknown>;
  const fullScore = Number(parsed.fullScore ?? 10);
  const score = Math.min(Math.max(Number(parsed.score ?? 0), 0), fullScore);
  return {
    score,
    fullScore,
    reason: String(parsed.reason ?? "需要老师复核"),
    // Defaults to 0 (lowest confidence) when the model omits the field or the
    // JSON is partially malformed — combined with the confidence-based routing
    // in `applyKimiResult`, a degraded/missing response naturally falls through
    // to teacher review instead of silently being trusted.
    confidence: Number(parsed.confidence ?? 0),
    usage: readUsage(data),
    reconstruction: parseReconstruction(parsed.reconstruction),
    pointChecks: parsePointChecks(parsed.pointChecks)
  };
}

/** Coerces a possibly-malformed `reconstruction` payload into a safe shape —
 *  missing/garbled data degrades to an empty transcription with confidence 0
 *  (i.e. "treat as unreadable"), never to a guessed-at structure. */
function parseReconstruction(value: unknown): { steps: ReconstructionStep[]; transcriptionConfidence: number } {
  if (!value || typeof value !== "object") {
    return { steps: [], transcriptionConfidence: 0 };
  }
  const raw = value as { steps?: unknown; transcriptionConfidence?: unknown };
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === "object")
        .map((step) => ({
          text: String(step.text ?? "").trim(),
          imageRegion: String(step.imageRegion ?? "").trim()
        }))
        .filter((step) => step.text.length > 0)
    : [];
  return {
    steps,
    transcriptionConfidence: Number(raw.transcriptionConfidence ?? 0)
  };
}

/** Coerces a possibly-malformed `pointChecks` payload into a safe array — drops
 *  entries that don't even have a `pointId`, never invents one. */
function parsePointChecks(value: unknown): PointCheck[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      pointId: String(item.pointId ?? "").trim(),
      satisfied: Boolean(item.satisfied),
      evidence: String(item.evidence ?? "").trim()
    }))
    .filter((item) => item.pointId.length > 0);
}

const PUNCTUATION_RE = /[\s，。、；：！？“”‘’「」『』（）()[\]{}]/g;

function normalizeForComparison(text: string): string {
  return text.replace(PUNCTUATION_RE, "").trim();
}

function toCharBigrams(text: string): Set<string> {
  if (text.length < 2) return new Set(text.length === 1 ? [text] : []);
  const grams = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) {
    grams.add(text.slice(i, i + 2));
  }
  return grams;
}

/**
 * Heuristic divergence (0 = near-identical, 1 = essentially unrelated) between
 * Kimi's grounded reconstruction text and the worker's *independent* OCR
 * `recognizedAnswer`. A large gap is itself a hallucination signal — distinct
 * from (and a useful complement to) Kimi's own self-reported `confidence`,
 * because a model can be "confidently" wrong. Uses character-bigram Jaccard
 * similarity rather than word segmentation, which suits short Chinese/math
 * strings without pulling in an NLP dependency.
 */
export function estimateReconstructionDivergence(reconstructionText: string, recognizedAnswer: string): number {
  const a = normalizeForComparison(reconstructionText);
  const b = normalizeForComparison(recognizedAnswer);
  if (!a && !b) return 0;
  if (!a || !b) return 1;
  if (a === b) return 0;

  const bigramsA = toCharBigrams(a);
  const bigramsB = toCharBigrams(b);
  if (bigramsA.size === 0 || bigramsB.size === 0) return 1;

  let intersection = 0;
  for (const gram of bigramsA) {
    if (bigramsB.has(gram)) intersection += 1;
  }
  const union = bigramsA.size + bigramsB.size - intersection;
  const similarity = union === 0 ? 1 : intersection / union;
  return 1 - similarity;
}
