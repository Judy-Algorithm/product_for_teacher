# Python Processing Worker

The worker performs expensive crop and OCR processing outside Vercel Functions.

Pipeline:

1. Download the image from object storage.
2. Detect the paper boundary with OpenCV.
3. Apply perspective correction.
4. Map answer-template question boxes onto the student sheet.
5. OCR each crop.
6. Route objective and simple questions to rule grading.
7. Send only complex questions to an LLM.
8. POST results to `/api/worker/callback`.

Recommended first deployment: Cloud Run or a private CPU server. Move to GPU only after OCR accuracy testing proves it is needed.

## Local Run

```bash
cd workers/python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8080
```

Health check:

```bash
curl http://localhost:8080/health
```

## Cloud Run Environment Variables

```text
WORKER_PUBLIC_URL=https://your-cloud-run-url
WORKER_SECRET=shared-secret-from-vercel
WORKER_CALLBACK_SECRET=shared-secret-from-vercel
```

Vercel environment variables:

```text
PYTHON_WORKER_URL=https://your-cloud-run-url
WORKER_CALLBACK_SECRET=the-same-shared-secret
NEXT_PUBLIC_APP_URL=https://product-for-teacher.vercel.app
```
