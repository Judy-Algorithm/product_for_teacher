import base64
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
import requests


Route = Literal["rule", "llm", "teacher_review"]


@dataclass
class CropBox:
    x: int
    y: int
    width: int
    height: int
    confidence: float


@dataclass
class QuestionCrop:
    question_id: str
    label: str
    question_type: str
    box: CropBox
    crop_path: str


QUESTION_TEMPLATES = [
    ("q1", "第一题", "copy_sentence", (0.08, 0.19, 0.86, 0.16)),
    ("q2", "第二题", "word", (0.08, 0.34, 0.86, 0.20)),
    ("q3", "第三题", "choice", (0.08, 0.52, 0.86, 0.22)),
    ("q4", "第四题", "word_building", (0.08, 0.73, 0.86, 0.18)),
]


def download_image(url: str, output_path: str) -> str:
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    Path(output_path).write_bytes(response.content)
    return output_path


def order_points(points: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1)
    rect[0] = points[np.argmin(sums)]
    rect[2] = points[np.argmax(sums)]
    rect[1] = points[np.argmin(diffs)]
    rect[3] = points[np.argmax(diffs)]
    return rect


def correct_perspective(image: np.ndarray) -> tuple[np.ndarray, CropBox]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        height, width = image.shape[:2]
        return image, CropBox(0, 0, width, height, 0.3)

    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    for contour in contours[:8]:
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approx) == 4:
            points = approx.reshape(4, 2).astype("float32")
            rect = order_points(points)
            top_left, top_right, bottom_right, bottom_left = rect
            width_a = np.linalg.norm(bottom_right - bottom_left)
            width_b = np.linalg.norm(top_right - top_left)
            height_a = np.linalg.norm(top_right - bottom_right)
            height_b = np.linalg.norm(top_left - bottom_left)
            max_width = int(max(width_a, width_b))
            max_height = int(max(height_a, height_b))
            destination = np.array(
                [[0, 0], [max_width - 1, 0], [max_width - 1, max_height - 1], [0, max_height - 1]],
                dtype="float32",
            )
            matrix = cv2.getPerspectiveTransform(rect, destination)
            warped = cv2.warpPerspective(image, matrix, (max_width, max_height))
            x, y, w, h = cv2.boundingRect(approx)
            return warped, CropBox(int(x), int(y), int(w), int(h), 0.9)

    height, width = image.shape[:2]
    return image, CropBox(0, 0, width, height, 0.4)


def crop_questions(corrected: np.ndarray, output_dir: str) -> list[QuestionCrop]:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    height, width = corrected.shape[:2]
    crops: list[QuestionCrop] = []

    for question_id, label, question_type, ratio in QUESTION_TEMPLATES:
        rx, ry, rw, rh = ratio
        x = int(rx * width)
        y = int(ry * height)
        w = int(rw * width)
        h = int(rh * height)
        crop = corrected[y : y + h, x : x + w]
        crop_path = str(Path(output_dir) / f"{question_id}.jpg")
        cv2.imwrite(crop_path, crop)
        crops.append(
            QuestionCrop(
                question_id=question_id,
                label=label,
                question_type=question_type,
                box=CropBox(x=x, y=y, width=w, height=h, confidence=0.7),
                crop_path=crop_path,
            )
        )

    return crops


def route_question(question_type: str, ocr_confidence: float) -> Route:
    if ocr_confidence < 0.75:
        return "teacher_review"
    if question_type in {"copy_sentence", "word", "choice", "word_building"}:
        return "rule"
    return "llm"


def get_ocr_engine():
    from paddleocr import PaddleOCR

    return PaddleOCR(use_angle_cls=True, lang="ch")


def run_ocr(crop_path: str, ocr_engine=None) -> tuple[str, float]:
    engine = ocr_engine or get_ocr_engine()
    raw_result = engine.ocr(crop_path, cls=True)
    lines = raw_result[0] if raw_result else []
    texts: list[str] = []
    confidences: list[float] = []

    for line in lines:
        if len(line) >= 2 and isinstance(line[1], (list, tuple)):
            text = str(line[1][0])
            confidence = float(line[1][1])
            texts.append(text)
            confidences.append(confidence)

    if not texts:
        return "", 0.0

    return "；".join(texts), sum(confidences) / len(confidences)


def build_crop_url(public_worker_url: str, job_id: str, crop_path: str) -> str:
    filename = Path(crop_path).name
    if public_worker_url:
        return f"{public_worker_url.rstrip('/')}/crops/{job_id}/{filename}"

    data = Path(crop_path).read_bytes()
    encoded = base64.b64encode(data).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"


def process_job(job_id: str, image_path: str, public_worker_url: str = "", ocr_engine=None) -> dict:
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    corrected, _paper_box = correct_perspective(image)
    output_dir = f"/tmp/worker-crops/{job_id}"
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    corrected_path = str(Path(output_dir) / "corrected.jpg")
    cv2.imwrite(corrected_path, corrected)

    question_crops = crop_questions(corrected, output_dir)
    results = []

    for crop in question_crops:
        recognized_answer, confidence = run_ocr(crop.crop_path, ocr_engine=ocr_engine)
        route = route_question(crop.question_type, confidence)
        results.append(
            {
                "questionId": crop.question_id,
                "cropUrl": build_crop_url(public_worker_url, job_id, crop.crop_path),
                "box": asdict(crop.box),
                "recognizedAnswer": recognized_answer,
                "ocrConfidence": confidence,
                "route": route,
                "score": 0,
                "reason": "等待规则评分或老师确认",
                "teacherComment": "",
                "tokenEstimate": {"input": 0, "output": 0, "savedByRouting": 0},
            }
        )

    return {
        "jobId": job_id,
        "status": "needs_review",
        "results": results,
        "correctedSheetUrl": build_crop_url(public_worker_url, job_id, corrected_path),
    }


def process_remote_job(job_id: str, student_sheet_url: str, public_worker_url: str = "") -> dict:
    input_path = f"/tmp/{job_id}-student-sheet"
    download_image(student_sheet_url, input_path)
    return process_job(job_id, input_path, public_worker_url=public_worker_url)
