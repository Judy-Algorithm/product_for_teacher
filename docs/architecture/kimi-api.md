# Kimi Grading API

## POST `/api/grade`

The browser never calls Kimi directly. The frontend sends a compact grading payload to this Vercel Route Handler, and the server reads `KIMI_API_KEY` from environment variables.

Request:

```json
{
  "questionId": "q4",
  "fullScore": 10,
  "standardAnswer": "拍（拍手）；村（村庄）；过（过去）；打（打开）；树（树木）",
  "rubric": "组词正确、书写清楚。",
  "studentAnswer": "拍手、村庄、过去、打开、树木",
  "calibration": "老师优先看总分和错因。"
}
```

Response:

```json
{
  "ok": true,
  "result": {
    "score": 10,
    "reason": "组词均正确",
    "confidence": 0.92
  }
}
```

Required Vercel environment variables:

```text
KIMI_API_KEY=your_kimi_key
KIMI_MODEL=moonshot-v1-8k
```

The API key must not be committed to GitHub. Keep it in `.env.local` locally and in Vercel Project Settings for deployment.
