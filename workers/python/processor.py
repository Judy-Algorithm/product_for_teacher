from dataclasses import dataclass
from typing import Literal


Route = Literal["rule", "llm", "teacher_review"]


@dataclass
class CropBox:
    x: int
    y: int
    width: int
    height: int
    confidence: float


def detect_paper_on_black_board(image_path: str) -> CropBox:
    """Production code should use OpenCV contours and four-point perspective correction."""
    return CropBox(x=40, y=60, width=1200, height=1600, confidence=0.98)


def route_question(question_type: str, ocr_confidence: float) -> Route:
    if ocr_confidence < 0.75:
        return "teacher_review"
    if question_type in {"copy_sentence", "word", "choice", "word_building"}:
        return "rule"
    return "llm"


def process_job(job_id: str, image_path: str) -> dict:
    paper_box = detect_paper_on_black_board(image_path)
    return {
        "jobId": job_id,
        "paperBox": paper_box.__dict__,
        "status": "needs_review",
        "results": []
    }
