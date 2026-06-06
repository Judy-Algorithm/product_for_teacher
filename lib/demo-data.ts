import type { GradingJob } from "./types";

export const demoJob: GradingJob = {
  id: "yuwen-grade1-demo",
  status: "needs_review",
  subject: "语文",
  grade: "一年级下册",
  title: "一年级下册语文期末拔尖测试卷",
  studentName: "李煜小学 一（8）班 杜白",
  totalScore: 100,
  answerSheetUrl: "/demo/answer-standard.png",
  studentSheetUrl: "/demo/student-sheet.svg",
  correctedSheetUrl: "/demo/student-sheet.svg",
  calibrationNotes: ["老师优先看总分和错因，技术细节默认收起。"],
  rubrics: [
    {
      questionId: "q1",
      label: "第一题",
      type: "copy_sentence",
      fullScore: 2,
      standardAnswer: "不知则问，不能则学。",
      standardSummary: "句子完整、字迹规范、标点正确得 2 分。",
      points: [{ id: "q1-p1", text: "句子完整、字迹规范、标点正确", score: 2 }],
      deductionRules: [{ id: "q1-d1", text: "错字、漏字、标点错误或书写明显不规范，每处扣 0.5 分", deduct: 0.5 }]
    },
    {
      questionId: "q2",
      label: "第二题",
      type: "word",
      fullScore: 16,
      standardAnswer: "前后；花朵；因为；运动；已经；故乡；声音；招呼",
      standardSummary: "共 8 个词语，每个词语 2 分。",
      points: [{ id: "q2-p1", text: "每个词语写对两个字得 2 分", score: 16 }],
      deductionRules: [{ id: "q2-d1", text: "错 1 个字扣 1 分，两个字均错或未写不得分", deduct: 1 }]
    },
    {
      questionId: "q3",
      label: "第三题",
      type: "choice",
      fullScore: 10,
      standardAnswer: "de；yuè；lè；zhǒng；zhòng；zhǐ；zhī；再；在；清",
      standardSummary: "共 10 个空，每空 1 分。",
      points: [{ id: "q3-p1", text: "选对得分", score: 10 }],
      deductionRules: [{ id: "q3-d1", text: "选错、漏选或多选不得分", deduct: 1 }]
    },
    {
      questionId: "q4",
      label: "第四题",
      type: "word_building",
      fullScore: 10,
      standardAnswer: "拍（拍手）；村（村庄）；过（过去）；打（打开）；树（树木）",
      standardSummary: "例题不计分，其余 5 题每题 2 分。",
      points: [{ id: "q4-p1", text: "组词正确、书写清楚", score: 10 }],
      deductionRules: [{ id: "q4-d1", text: "词语不通顺、错字或漏写不得分", deduct: 2 }]
    }
  ],
  results: [
    {
      questionId: "q1",
      cropUrl: "/demo/crop-q1.svg",
      box: { x: 95, y: 250, width: 680, height: 170, confidence: 0.96 },
      recognizedAnswer: "不知则问，不能则学。",
      ocrConfidence: 0.93,
      route: "rule",
      score: 2,
      reason: "句子完整，标点正确。",
      teacherComment: "书写较规范。",
      tokenEstimate: { input: 0, output: 0, savedByRouting: 280 }
    },
    {
      questionId: "q2",
      cropUrl: "/demo/crop-q2.svg",
      box: { x: 70, y: 460, width: 760, height: 260, confidence: 0.94 },
      recognizedAnswer: "前后、花朵、因为、运动、已经、故乡、声音、招呼",
      ocrConfidence: 0.9,
      route: "rule",
      score: 16,
      reason: "8 个词语均正确。",
      teacherComment: "拼音对应准确。",
      tokenEstimate: { input: 0, output: 0, savedByRouting: 520 }
    },
    {
      questionId: "q3",
      cropUrl: "/demo/crop-q3.svg",
      box: { x: 70, y: 760, width: 760, height: 330, confidence: 0.91 },
      recognizedAnswer: "de；yuè；lè；zhǒng；zhòng；zhǐ；zhī；再；在；清",
      ocrConfidence: 0.86,
      route: "rule",
      score: 10,
      reason: "10 个选项均正确。",
      teacherComment: "选择准确。",
      tokenEstimate: { input: 0, output: 0, savedByRouting: 460 }
    },
    {
      questionId: "q4",
      cropUrl: "/demo/crop-q4.svg",
      box: { x: 80, y: 1110, width: 720, height: 210, confidence: 0.89 },
      recognizedAnswer: "拍手、村庄、过去、打开、树木",
      ocrConfidence: 0.84,
      route: "teacher_review",
      score: 10,
      reason: "5 个组词均可接受。",
      teacherComment: "组词正确。",
      tokenEstimate: { input: 0, output: 0, savedByRouting: 360 }
    }
  ]
};
