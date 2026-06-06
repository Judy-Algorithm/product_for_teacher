# AI Grading Pipeline Architecture

```mermaid
flowchart LR
  subgraph Capture["1. Capture"]
    A["Hardware camera / teacher upload"]
    A1["Student paper image"]
    A2["Answer key and rubric"]
    A --> A1
    A --> A2
  end

  subgraph Vercel["2. Vercel web backend"]
    B["Upload API<br/>/api/uploads/paper<br/>/api/hardware/upload"]
    C["Object storage<br/>Vercel Blob or S3"]
    D["Job record<br/>status: uploaded / processing"]
    Q["Queue or worker trigger"]
  end

  subgraph Worker["3. Python processing worker"]
    E["Download image"]
    F["Paper detection<br/>black-board boundary"]
    G["Perspective correction"]
    H["Question anchor detection<br/>OCR finds 一、二、三、四"]
    I["Crop each question"]
    J["OCR handwriting / text"]
  end

  subgraph Grading["4. Grading decision"]
    K{"Route decision"}
    L["Rule grading<br/>choice, word, copy sentence"]
    M["LLM grading<br/>short answer / complex rubric"]
    N["Teacher review<br/>low OCR confidence"]
  end

  subgraph Review["5. Teacher review and output"]
    O["Worker callback<br/>/api/worker/callback"]
    P["Teacher review UI<br/>crop + answer + score + reason"]
    R["Teacher confirms or edits"]
    S["Final marked sheet"]
    T["Export score table / marked image"]
  end

  A1 --> B
  A2 --> D
  B --> C
  B --> D
  D --> Q
  Q --> E
  C --> E
  E --> F --> G --> H --> I --> J --> K
  K -->|"OCR confidence < 0.75"| N
  K -->|"simple question type"| L
  K -->|"complex answer"| M
  L --> O
  M --> O
  N --> O
  O --> D
  O --> P
  P --> R --> S --> T
```

## Step-by-step flow

1. The teacher or hardware device uploads a student paper image. The answer key and rubric provide the scoring standard.
2. Vercel receives the upload, stores the image, creates a job record, and triggers the Python worker.
3. The Python worker downloads the image, detects the paper boundary, corrects perspective, finds question-number anchors such as `一、` and `二、`, crops each question from one anchor to the next, and runs OCR on every crop.
4. The grading router decides how to score each question:
   - low OCR confidence goes to teacher review;
   - simple objective or low-grade language questions use rules;
   - complex short-answer questions go to the LLM.
5. The worker sends results back to Vercel. The teacher sees each crop, recognized answer, score, reason, and can confirm or edit before exporting the final marked sheet.

## Current implementation status

- Implemented: Next.js UI, local upload API, hardware upload API, Kimi grading API, in-memory job record, worker callback, demo review and result pages.
- Partial: Vercel Blob storage is supported when `BLOB_READ_WRITE_TOKEN` is configured.
- Implemented in worker: paper correction, OCR-driven question anchor detection, template fallback, crop confidence status, crop/OCR result callback.
- Production work needed: persistent database, queue, device authentication, real OpenCV/OCR, saved teacher edits, and real export generation.

## No Manual Box Adjustment

Teachers should not drag or resize crop boxes. If OCR cannot find enough question anchors, the worker falls back to the current paper template and marks low-confidence crops as `needs_rescan`. The UI should ask for a better photo instead of exposing a box editor.
