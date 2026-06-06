import unittest

import numpy as np

from processor import (
    OcrTextBox,
    build_question_boxes_from_anchors,
    crop_fallback_template_questions,
    detect_question_anchors_from_boxes,
)


class QuestionAnchorCropTests(unittest.TestCase):
    def test_detects_first_four_chinese_question_anchors(self):
        boxes = [
            OcrTextBox("得分", 80, 80, 50, 24, 0.95),
            OcrTextBox("一、按要求规范书写下面句子。", 120, 300, 360, 40, 0.93),
            OcrTextBox("二、读拼音，写词语。", 118, 620, 320, 40, 0.94),
            OcrTextBox("三、在正确的答案下面画“√”。", 116, 980, 420, 40, 0.91),
            OcrTextBox("四、照样子，完成练习。", 119, 1390, 360, 40, 0.9),
        ]

        anchors = detect_question_anchors_from_boxes(boxes, page_width=1000, page_height=1600)

        self.assertEqual([anchor.question_id for anchor in anchors], ["q1", "q2", "q3", "q4"])
        self.assertEqual([anchor.label for anchor in anchors], ["第一题", "第二题", "第三题", "第四题"])

    def test_anchor_boxes_start_first_crop_at_question_title_not_score_table(self):
        page = np.full((1600, 1000, 3), 255, dtype=np.uint8)
        boxes = [
            OcrTextBox("一、按要求规范书写下面句子。", 120, 300, 360, 40, 0.93),
            OcrTextBox("二、读拼音，写词语。", 118, 620, 320, 40, 0.94),
            OcrTextBox("三、在正确的答案下面画“√”。", 116, 980, 420, 40, 0.91),
            OcrTextBox("四、照样子，完成练习。", 119, 1390, 360, 40, 0.9),
        ]
        anchors = detect_question_anchors_from_boxes(boxes, page_width=1000, page_height=1600)

        crops = build_question_boxes_from_anchors(page, anchors)

        self.assertGreaterEqual(crops[0].box.y, 260)
        self.assertLess(crops[0].box.y, 300)
        self.assertLess(crops[0].box.y + crops[0].box.height, 620)
        self.assertGreater(crops[1].box.height, 250)

    def test_fallback_template_is_used_when_anchor_count_is_too_low(self):
        page = np.full((1600, 1000, 3), 255, dtype=np.uint8)
        anchors = detect_question_anchors_from_boxes(
            [OcrTextBox("一、按要求规范书写下面句子。", 120, 300, 360, 40, 0.93)],
            page_width=1000,
            page_height=1600,
        )

        self.assertEqual(build_question_boxes_from_anchors(page, anchors), [])


class FallbackTemplateTests(unittest.TestCase):
    def test_fallback_template_marks_low_confidence_boxes(self):
        page = np.full((1600, 1000, 3), 255, dtype=np.uint8)
        crops = crop_fallback_template_questions(page, "/tmp/teacher-grading-test-crops")

        self.assertEqual(len(crops), 4)
        self.assertLess(crops[0].box.confidence, 0.6)


if __name__ == "__main__":
    unittest.main()
