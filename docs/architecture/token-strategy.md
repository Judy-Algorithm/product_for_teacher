# Token Strategy

## Default Principle

Use deterministic algorithms before LLM calls. The LLM receives only the minimum grading context for complex questions.

## Teacher UI Rule

Teacher pages do not show token or routing metrics by default. These are available only in a small technical disclosure for partner demos and debugging.

## Rule-Graded Questions

The following question types should avoid LLM calls when OCR confidence is at least 0.75:

- Copy sentence
- Word writing
- Choice
- Word building

## LLM-Graded Questions

Use LLM calls for:

- Reading comprehension
- Essay
- Low-confidence answers selected by the teacher

## Prompt Compression

Each LLM request includes:

- Question ID
- Full score
- Structured rubric
- Standard answer
- OCR text
- Same-batch calibration note
- Strict JSON output schema

Each LLM request excludes:

- Full paper image
- Unrelated questions
- Full previous conversations
- Long teacher notes not summarized into the current rubric

## Caching

Cache by:

```text
taskId + questionId + rubricHash + normalizedStudentAnswer + calibrationHash
```
