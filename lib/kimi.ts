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

export async function gradeWithKimiVision(input: KimiVisionGradeInput): Promise<KimiVisionGradeResult> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    throw new Error("KIMI_API_KEY is not configured");
  }

  const visionModel = process.env.KIMI_VISION_MODEL ?? "moonshot-v1-8k-vision-preview";

  const content: VisionContentPart[] = [
    { type: "image_url", image_url: { url: input.answerSheetUrl } }
  ];

  const hasCrop = input.cropUrl && !input.cropUrl.startsWith("data:");
  if (hasCrop) {
    content.push({ type: "image_url", image_url: { url: input.cropUrl! } });
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
