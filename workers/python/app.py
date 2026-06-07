import os
from typing import Optional

import requests
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl

from processor import process_remote_job


class ProcessRequest(BaseModel):
    jobId: str
    studentSheetUrl: HttpUrl
    answerSheetUrl: Optional[HttpUrl] = None
    callbackUrl: Optional[HttpUrl] = None
    callbackSecret: str = ""


app = FastAPI(title="Teacher Grading OCR Worker")
app.mount("/crops", StaticFiles(directory="/tmp/worker-crops"), name="crops")


@app.get("/health")
def health():
    return {"ok": True}


def callback_result(request: ProcessRequest, result: dict) -> None:
    callback_url = str(request.callbackUrl) if request.callbackUrl else os.getenv("WORKER_CALLBACK_URL", "")
    if not callback_url:
        return

    headers = {}
    callback_secret = request.callbackSecret or os.getenv("WORKER_CALLBACK_SECRET", "")
    if callback_secret:
        headers["x-worker-secret"] = callback_secret

    response = requests.post(callback_url, json=result, headers=headers, timeout=30)
    response.raise_for_status()


def process_and_callback(request: ProcessRequest) -> None:
    try:
        public_worker_url = os.getenv("WORKER_PUBLIC_URL", "")
        result = process_remote_job(
            request.jobId,
            str(request.studentSheetUrl),
            answer_sheet_url=str(request.answerSheetUrl) if request.answerSheetUrl else None,
            public_worker_url=public_worker_url,
        )
    except Exception as error:
        result = {
            "jobId": request.jobId,
            "status": "failed",
            "results": [],
            "correctedSheetUrl": None,
            "error": str(error),
        }

    callback_result(request, result)


@app.post("/process")
def process(request: ProcessRequest, x_worker_secret: str = Header(default="")):
    expected_secret = os.getenv("WORKER_SECRET", "")
    if expected_secret and x_worker_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Invalid worker secret")

    public_worker_url = os.getenv("WORKER_PUBLIC_URL", "")
    result = process_remote_job(
        request.jobId,
        str(request.studentSheetUrl),
        answer_sheet_url=str(request.answerSheetUrl) if request.answerSheetUrl else None,
        public_worker_url=public_worker_url,
    )

    callback_url = str(request.callbackUrl) if request.callbackUrl else os.getenv("WORKER_CALLBACK_URL", "")
    if callback_url:
        headers = {}
        callback_secret = request.callbackSecret or os.getenv("WORKER_CALLBACK_SECRET", "")
        if callback_secret:
            headers["x-worker-secret"] = callback_secret
        response = requests.post(callback_url, json=result, headers=headers, timeout=30)
        response.raise_for_status()

    return result


@app.post("/process-async")
def process_async(request: ProcessRequest, background_tasks: BackgroundTasks, x_worker_secret: str = Header(default="")):
    expected_secret = os.getenv("WORKER_SECRET", "")
    if expected_secret and x_worker_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Invalid worker secret")

    background_tasks.add_task(process_and_callback, request)
    return {"ok": True, "jobId": request.jobId, "status": "processing"}
