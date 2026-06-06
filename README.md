# Product for Teachers

Vercel-ready demo for a teacher-facing AI grading workflow.

## Run Locally

```bash
npm install
cp .env.example .env.local
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

## Backend API

This project uses Next.js Route Handlers as a lightweight backend on Vercel:

- `POST /api/uploads/paper`: accepts a local image file from the browser. In production, configure `BLOB_READ_WRITE_TOKEN` to store files in Vercel Blob. Without it, local development returns an inline preview URL.
- `POST /api/grade`: calls Kimi from the server using `KIMI_API_KEY`.
- `POST /api/hardware/upload`: receives image metadata from a hardware partner.
- `POST /api/worker/callback`: receives crop/OCR results from the Python worker.

Vercel environment variables:

```text
KIMI_API_KEY=your_kimi_key
KIMI_MODEL=moonshot-v1-8k
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

## Processing Boundary

Vercel handles the web UI, upload endpoint, job state, and callback endpoint. Expensive crop and OCR work should run in the Python worker described in `workers/python/README.md`.
