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

    def test_arabic_numeral_sub_item_does_not_spawn_a_phantom_question(self):
        # Real sheet: only 题一~题四 exist (Chinese-numeral headers). 题三's last
        # bullet ("5.过了（青/晴）明节…") and 题四's fill-in blank ("5.村(村庄)")
        # both carry Arabic-numeral prefixes that parse to the same integer as a
        # *would-be* "五、" — but there is no 题五 on this page. Before the fix,
        # one of these spawned a phantom "q5" anchor that carved a sliver crop
        # out of the boundary between 题三 and 题四 (see processor.py comments).
        boxes = [
            OcrTextBox("一、按要求规范书写下面句子。", 120, 300, 360, 40, 0.93),
            OcrTextBox("二、读拼音，写词语。", 118, 620, 320, 40, 0.94),
            OcrTextBox("三、在正确的答案下面画“√”。", 116, 980, 420, 40, 0.91),
            OcrTextBox("5.过了（青/晴）明节，天气越来越热了", 130, 1340, 380, 36, 0.92),
            OcrTextBox("四、照样子，完成练习。", 119, 1390, 360, 40, 0.9),
            OcrTextBox("5.村(村庄)", 200, 1700, 140, 32, 0.88),
        ]

        anchors = detect_question_anchors_from_boxes(boxes, page_width=1000, page_height=2000)

        self.assertEqual([anchor.question_id for anchor in anchors], ["q1", "q2", "q3", "q4"])
        self.assertEqual(anchors[3].text, "四、照样子，完成练习。")

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

        # _make_fallback_templates(12) evenly distributes 12 question slots below
        # the header block — see processor.FALLBACK_QUESTION_TEMPLATES.
        self.assertEqual(len(crops), 12)
        self.assertLess(crops[0].box.confidence, 0.6)


if __name__ == "__main__":
    unittest.main()
