# Product for Teachers

Vercel-ready demo for a teacher-facing AI grading workflow.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo Flow

1. Home page: shows the photographed student paper and the uploaded answer/scoring standard.
2. Review page: shows each question crop on the left and a simple teacher confirmation panel on the right.
3. Results page: shows the annotated paper, score summary, and export buttons.

## Hardware API

The hardware partner can submit captured image metadata to:

```text
POST /api/hardware/upload
```

See `docs/architecture/hardware-api.md` for the payload.

## Processing Boundary

Vercel handles the web UI, upload endpoint, job state, and callback endpoint. Expensive crop and OCR work should run in the Python worker described in `workers/python/README.md`.

