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
