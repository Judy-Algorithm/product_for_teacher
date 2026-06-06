# Hardware Upload API

## POST `/api/hardware/upload`

Hardware or the partner app sends the captured image URL after upload.

Request:

```json
{
  "deviceId": "device-001",
  "taskId": "task-2026-001",
  "imageUrl": "https://example.com/student-sheet.jpg",
  "imageType": "student_sheet"
}
```

Response:

```json
{
  "ok": true,
  "jobId": "task-2026-001",
  "next": "/pipeline/task-2026-001"
}
```

Production requirements:

- Add device authentication with a per-device API key or signed upload token.
- Store the image in Vercel Blob or S3-compatible object storage.
- Queue a Python processing job after upload.
- Persist job state in Postgres instead of memory.
