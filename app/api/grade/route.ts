import { NextResponse } from "next/server";
import { gradeWithKimi, type KimiGradeInput } from "@/lib/kimi";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json()) as KimiGradeInput;

  if (!body.questionId || !body.standardAnswer || !body.rubric || !body.studentAnswer) {
    return NextResponse.json({ ok: false, error: "Missing grading fields" }, { status: 400 });
  }

  try {
    const result = await gradeWithKimi(body);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown grading error";
    const status = message.includes("KIMI_API_KEY") ? 500 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
