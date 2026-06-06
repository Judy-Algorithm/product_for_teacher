import base64
import re
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


@dataclass
class OcrTextBox:
    text: str
    x: int
    y: int
    width: int
    height: int
    confidence: float


@dataclass
class QuestionAnchor:
    question_id: str
    label: str
    text: str
    box: CropBox
    order: int


FALLBACK_QUESTION_TEMPLATES = [
    ("q1", "第一题", "copy_sentence", (0.08, 0.19, 0.86, 0.16)),
    ("q2", "第二题", "word", (0.08, 0.34, 0.86, 0.20)),
    ("q3", "第三题", "choice", (0.08, 0.52, 0.86, 0.22)),
    ("q4", "第四题", "word_building", (0.08, 0.73, 0.86, 0.18)),
]

QUESTION_NUMBER_MAP = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}

QUESTION_TYPE_BY_ID = {
    "q1": "copy_sentence",
    "q2": "word",
    "q3": "choice",
    "q4": "word_building",
}


def question_label(index: int) -> str:
    labels = ["第一题", "第二题", "第三题", "第四题", "第五题", "第六题", "第七题", "第八题", "第九题", "第十题"]
    return labels[index] if index < len(labels) else f"第{index + 1}题"


def question_label_from_number(number: int) -> str:
    return question_label(number - 1)


def normalize_ocr_text(text: str) -> str:
    return re.sub(r"\s+", "", text).replace("．", ".").replace("，", "、")


def parse_question_number(text: str) -> int | None:
    normalized = normalize_ocr_text(text)
    if not normalized:
        return None

    chinese_match = re.match(r"^[（(]?([一二三四五六七八九十])[）)]?[、.]", normalized)
    if chinese_match:
        return QUESTION_NUMBER_MAP.get(chinese_match.group(1))

    arabic_match = re.match(r"^(\d{1,2})[、.]", normalized)
    if arabic_match:
        number = int(arabic_match.group(1))
        return number if 1 <= number <= 20 else None

    return None


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
    image_height, image_width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return image, CropBox(0, 0, image_width, image_height, 0.3)

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
            contour_area = cv2.contourArea(contour)
            image_area = image_width * image_height
            aspect_ratio = max_width / max(max_height, 1)
            if contour_area < image_area * 0.18 or max_height < image_height * 0.35 or aspect_ratio > 1.6:
                continue

            destination = np.array(
                [[0, 0], [max_width - 1, 0], [max_width - 1, max_height - 1], [0, max_height - 1]],
                dtype="float32",
            )
            matrix = cv2.getPerspectiveTransform(rect, destination)
            warped = cv2.warpPerspective(image, matrix, (max_width, max_height))
            x, y, w, h = cv2.boundingRect(approx)
            return warped, CropBox(int(x), int(y), int(w), int(h), 0.9)

    return image, CropBox(0, 0, image_width, image_height, 0.4)


def polygon_to_box(points) -> CropBox | None:
    try:
        array = np.array(points, dtype="float32").reshape(-1, 2)
    except Exception:
        return None

    if array.size == 0:
        return None

    x, y, w, h = cv2.boundingRect(array.astype("int32"))
    return CropBox(int(x), int(y), int(w), int(h), 0.0)


def collect_ocr_text_boxes(result) -> list[OcrTextBox]:
    boxes: list[OcrTextBox] = []

    def first_present(data: dict, keys: list[str]):
        for key in keys:
            value = data.get(key)
            if value is not None:
                return value
        return []

    def append_box(text: str, score: float, raw_box) -> None:
        if not text:
            return
        box = polygon_to_box(raw_box)
        if not box:
            return
        boxes.append(
            OcrTextBox(
                text=str(text),
                x=box.x,
                y=box.y,
                width=box.width,
                height=box.height,
                confidence=float(score),
            )
        )

    def collect(payload) -> None:
        if payload is None:
            return

        if hasattr(payload, "json"):
            json_result = payload.json
            collect(json_result() if callable(json_result) else json_result)
            return

        if isinstance(payload, dict):
            data = payload.get("res", payload)
            rec_texts = data.get("rec_texts")
            rec_scores = data.get("rec_scores") or []
            rec_boxes = first_present(data, ["rec_boxes", "rec_polys", "dt_polys"])
            if isinstance(rec_texts, list) and isinstance(rec_boxes, list):
                for index, text in enumerate(rec_texts):
                    score = rec_scores[index] if index < len(rec_scores) else 0.0
                    raw_box = rec_boxes[index] if index < len(rec_boxes) else None
                    append_box(str(text), float(score), raw_box)
                return

            for value in data.values():
                collect(value)
            return

        if isinstance(payload, (list, tuple)):
            if len(payload) >= 2 and isinstance(payload[1], (list, tuple)) and payload[1]:
                raw_box = payload[0]
                text = payload[1][0]
                score = payload[1][1] if len(payload[1]) > 1 else 0.0
                append_box(str(text), float(score), raw_box)
                return

            for item in payload:
                collect(item)

    collect(result)
    return boxes


def run_ocr_layout(image_path: str, ocr_engine) -> list[OcrTextBox]:
    if hasattr(ocr_engine, "predict"):
        raw_result = ocr_engine.predict(image_path)
    else:
        raw_result = ocr_engine.ocr(image_path)
    return collect_ocr_text_boxes(raw_result)


def detect_question_anchors_from_boxes(ocr_boxes: list[OcrTextBox], page_width: int, page_height: int) -> list[QuestionAnchor]:
    anchors_by_number: dict[int, QuestionAnchor] = {}
    min_y = int(page_height * 0.08)
    max_x = int(page_width * 0.45)

    for text_box in ocr_boxes:
        if text_box.y < min_y or text_box.x > max_x:
            continue

        number = parse_question_number(text_box.text)
        if number is None:
            continue

        current = anchors_by_number.get(number)
        if current and current.box.confidence >= text_box.confidence:
            continue

        question_id = f"q{number}"
        anchors_by_number[number] = QuestionAnchor(
            question_id=question_id,
            label=question_label_from_number(number),
            text=text_box.text,
            box=CropBox(text_box.x, text_box.y, text_box.width, text_box.height, text_box.confidence),
            order=number,
        )

    return sorted(anchors_by_number.values(), key=lambda anchor: (anchor.order, anchor.box.y))


def text_density(crop: np.ndarray) -> float:
    if crop.size == 0:
        return 0.0
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    threshold = cv2.threshold(gray, 210, 255, cv2.THRESH_BINARY_INV)[1]
    return float(cv2.countNonZero(threshold)) / float(crop.shape[0] * crop.shape[1])


def crop_quality(corrected: np.ndarray, box: CropBox, anchor: QuestionAnchor) -> float:
    page_height, _page_width = corrected.shape[:2]
    crop = corrected[box.y : box.y + box.height, box.x : box.x + box.width]
    height_ratio = box.height / max(page_height, 1)
    density = text_density(crop)
    score = 0.45

    if 0.08 <= height_ratio <= 0.35:
        score += 0.2
    if density >= 0.012:
        score += 0.2
    if anchor.box.y >= box.y and anchor.box.y + anchor.box.height <= box.y + box.height:
        score += 0.15

    return min(score, 0.95)


def build_question_boxes_from_anchors(corrected: np.ndarray, anchors: list[QuestionAnchor]) -> list[QuestionCrop]:
    height, width = corrected.shape[:2]
    ordered = sorted(anchors, key=lambda anchor: anchor.box.y)
    if len(ordered) < 2:
        return []

    left = max(0, min(anchor.box.x for anchor in ordered) - int(width * 0.04))
    right = min(width, width - int(width * 0.04))
    vertical_pad_top = int(height * 0.012)
    vertical_pad_bottom = int(height * 0.018)
    gaps = [ordered[index + 1].box.y - ordered[index].box.y for index in range(len(ordered) - 1)]
    median_gap = int(np.median(gaps)) if gaps else int(height * 0.18)
    crops: list[QuestionCrop] = []

    for index, anchor in enumerate(ordered):
        y1 = max(0, anchor.box.y - vertical_pad_top)
        if index + 1 < len(ordered):
            y2 = max(y1 + int(height * 0.08), ordered[index + 1].box.y - vertical_pad_bottom)
        else:
            y2 = min(height, anchor.box.y + max(median_gap, int(height * 0.16)))

        box = CropBox(
            x=left,
            y=y1,
            width=right - left,
            height=max(1, y2 - y1),
            confidence=0.0,
        )
        box.confidence = crop_quality(corrected, box, anchor)
        crops.append(
            QuestionCrop(
                question_id=anchor.question_id,
                label=anchor.label,
                question_type=QUESTION_TYPE_BY_ID.get(anchor.question_id, "short_answer"),
                box=box,
                crop_path="",
            )
        )

    return crops


def detect_question_boxes(corrected: np.ndarray) -> list[CropBox]:
    gray = cv2.cvtColor(corrected, cv2.COLOR_BGR2GRAY)
    threshold = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 12)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (35, 9))
    merged = cv2.dilate(threshold, kernel, iterations=2)
    contours, _ = cv2.findContours(merged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    height, width = corrected.shape[:2]
    min_area = width * height * 0.012
    max_area = width * height * 0.45
    candidates: list[CropBox] = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area < min_area or area > max_area:
            continue
        if w < width * 0.35 or h < height * 0.045:
            continue
        if y < height * 0.08:
            continue

        pad_x = int(width * 0.025)
        pad_y = int(height * 0.015)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(width, x + w + pad_x)
        y2 = min(height, y + h + pad_y)
        candidates.append(CropBox(x=x1, y=y1, width=x2 - x1, height=y2 - y1, confidence=0.72))

    candidates.sort(key=lambda box: (box.y, box.x))
    merged_boxes: list[CropBox] = []

    for box in candidates:
        if not merged_boxes:
            merged_boxes.append(box)
            continue

        previous = merged_boxes[-1]
        overlap_y = min(previous.y + previous.height, box.y + box.height) - max(previous.y, box.y)
        if overlap_y > min(previous.height, box.height) * 0.35:
            x1 = min(previous.x, box.x)
            y1 = min(previous.y, box.y)
            x2 = max(previous.x + previous.width, box.x + box.width)
            y2 = max(previous.y + previous.height, box.y + box.height)
            merged_boxes[-1] = CropBox(x=x1, y=y1, width=x2 - x1, height=y2 - y1, confidence=0.68)
        else:
            merged_boxes.append(box)

    return merged_boxes


def crop_detected_questions(corrected: np.ndarray, output_dir: str, boxes: list[CropBox]) -> list[QuestionCrop]:
    crops: list[QuestionCrop] = []

    for index, box in enumerate(boxes):
        crop = corrected[box.y : box.y + box.height, box.x : box.x + box.width]
        crop_path = str(Path(output_dir) / f"q{index + 1}.jpg")
        cv2.imwrite(crop_path, crop)
        crops.append(
            QuestionCrop(
                question_id=f"q{index + 1}",
                label=question_label(index),
                question_type="short_answer",
                box=box,
                crop_path=crop_path,
            )
        )

    return crops


def crop_anchor_questions(corrected: np.ndarray, output_dir: str, crops: list[QuestionCrop]) -> list[QuestionCrop]:
    saved: list[QuestionCrop] = []

    for crop in crops:
        image_crop = corrected[crop.box.y : crop.box.y + crop.box.height, crop.box.x : crop.box.x + crop.box.width]
        crop_path = str(Path(output_dir) / f"{crop.question_id}.jpg")
        cv2.imwrite(crop_path, image_crop)
        saved.append(
            QuestionCrop(
                question_id=crop.question_id,
                label=crop.label,
                question_type=crop.question_type,
                box=crop.box,
                crop_path=crop_path,
            )
        )

    return saved


def crop_fallback_template_questions(corrected: np.ndarray, output_dir: str) -> list[QuestionCrop]:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    height, width = corrected.shape[:2]
    crops: list[QuestionCrop] = []

    for question_id, label, question_type, ratio in FALLBACK_QUESTION_TEMPLATES:
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
                box=CropBox(x=x, y=y, width=w, height=h, confidence=0.55),
                crop_path=crop_path,
            )
        )

    return crops


def crop_questions(corrected: np.ndarray, output_dir: str, corrected_path: str, ocr_engine=None) -> list[QuestionCrop]:
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    if ocr_engine is not None:
        height, width = corrected.shape[:2]
        ocr_boxes = run_ocr_layout(corrected_path, ocr_engine)
        anchors = detect_question_anchors_from_boxes(ocr_boxes, width, height)
        anchor_crops = build_question_boxes_from_anchors(corrected, anchors)
        if len(anchor_crops) >= 2:
            return crop_anchor_questions(corrected, output_dir, anchor_crops)

    return crop_fallback_template_questions(corrected, output_dir)


def route_question(question_type: str, ocr_confidence: float) -> Route:
    if ocr_confidence < 0.75:
        return "teacher_review"
    if question_type in {"copy_sentence", "word", "choice", "word_building"}:
        return "rule"
    return "llm"


def get_ocr_engine():
    os.environ.setdefault("FLAGS_use_mkldnn", "0")
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("CPU_NUM", "1")
    from paddleocr import PaddleOCR

    return PaddleOCR(use_angle_cls=True, lang="ch")


def run_ocr(crop_path: str, ocr_engine=None) -> tuple[str, float]:
    engine = ocr_engine or get_ocr_engine()
    texts: list[str] = []
    confidences: list[float] = []

    if hasattr(engine, "predict"):
        raw_result = engine.predict(crop_path)
    else:
        raw_result = engine.ocr(crop_path)

    def collect_ocr_text(result) -> None:
        if result is None:
            return

        if hasattr(result, "json"):
            json_result = result.json
            collect_ocr_text(json_result() if callable(json_result) else json_result)
            return

        if isinstance(result, dict):
            payload = result.get("res", result)
            rec_texts = payload.get("rec_texts")
            rec_scores = payload.get("rec_scores") or []
            if isinstance(rec_texts, list):
                for index, text in enumerate(rec_texts):
                    if text:
                        texts.append(str(text))
                        score = rec_scores[index] if index < len(rec_scores) else 0.0
                        confidences.append(float(score))
                return

            for value in payload.values():
                collect_ocr_text(value)
            return

        if isinstance(result, (list, tuple)):
            if len(result) >= 2 and isinstance(result[1], (list, tuple)) and result[1]:
                text = result[1][0]
                if text:
                    texts.append(str(text))
                    score = result[1][1] if len(result[1]) > 1 else 0.0
                    confidences.append(float(score))
                    return

            for item in result:
                collect_ocr_text(item)

    collect_ocr_text(raw_result)

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

    engine = ocr_engine or get_ocr_engine()
    question_crops = crop_questions(corrected, output_dir, corrected_path, ocr_engine=engine)
    results = []

    for crop in question_crops:
        recognized_answer, confidence = run_ocr(crop.crop_path, ocr_engine=engine)
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
                "cropConfidence": "low" if crop.box.confidence < 0.6 else "medium" if crop.box.confidence < 0.8 else "high",
                "reviewStatus": "needs_rescan" if crop.box.confidence < 0.6 else "auto_accepted",
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
