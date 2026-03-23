import argparse
import json
from pathlib import Path

from extractAnswersFromImages import (
    LESSON_RE,
    OPTION_RE,
    QUESTION_RE,
    line_center_y,
    line_left_x,
    normalize_text,
    parse_ocr_number,
    yellow_ratio,
)

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR


def extract_raw_scores(image_dir: Path):
    files = sorted(list(image_dir.glob("*.jpg")) + list(image_dir.glob("*.jpeg")) + list(image_dir.glob("*.png")))
    if not files:
        raise SystemExit(f"No image files found in: {image_dir}")

    ocr = RapidOCR()
    scores = {}

    current_lesson = None
    current_question = None
    current_option = None
    current_option_y = None
    current_option_x = None

    for file in files:
        raw = np.fromfile(str(file), dtype=np.uint8)
        img = cv2.imdecode(raw, cv2.IMREAD_COLOR)
        if img is None:
            continue

        result, _ = ocr(img)
        if not result:
            continue

        rows = sorted(result, key=lambda item: (line_center_y(item[0]), line_left_x(item[0])))

        for quad, text, _conf in rows:
            cleaned = normalize_text(text)
            if not cleaned:
                continue

            ratio = yellow_ratio(img, quad)
            y = line_center_y(quad)
            x = line_left_x(quad)

            lesson_match = LESSON_RE.search(cleaned)
            if lesson_match:
                lesson_no = parse_ocr_number(lesson_match.group(1))
                if lesson_no is None or lesson_no < 1 or lesson_no > 12:
                    continue
                current_lesson = lesson_no
                current_question = None
                current_option = None
                current_option_y = None
                current_option_x = None
                continue

            q_match = QUESTION_RE.search(cleaned)
            if q_match:
                next_question = parse_ocr_number(q_match.group(1))
                if next_question is None or next_question < 1 or next_question > 40:
                    continue

                if current_lesson is None:
                    current_lesson = 1
                elif current_question is not None:
                    reset_by_one = next_question == 1 and current_question >= 20
                    reset_by_drop = next_question <= 3 and current_question >= 25
                    if reset_by_one or reset_by_drop:
                        current_lesson += 1

                current_question = next_question
                current_option = None
                current_option_y = None
                current_option_x = None
                continue

            opt_match = OPTION_RE.match(cleaned)
            if opt_match and current_lesson is not None and current_question is not None:
                opt = opt_match.group(1).upper()
                current_option = opt
                current_option_y = y
                current_option_x = x

                lesson_bucket = scores.setdefault(str(current_lesson), {})
                question_bucket = lesson_bucket.setdefault(str(current_question), {})
                question_bucket[opt] = max(float(question_bucket.get(opt, 0.0)), ratio)
                continue

            if (
                current_lesson is not None
                and current_question is not None
                and current_option is not None
                and current_option_y is not None
                and current_option_x is not None
            ):
                if abs(y - current_option_y) <= 65 and x >= (current_option_x + 8):
                    lesson_bucket = scores.setdefault(str(current_lesson), {})
                    question_bucket = lesson_bucket.setdefault(str(current_question), {})
                    question_bucket[current_option] = max(float(question_bucket.get(current_option, 0.0)), ratio)

    return scores


def main():
    parser = argparse.ArgumentParser(description="Extract raw option highlight scores without thresholding.")
    parser.add_argument("--image-dir", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--subject", default="")
    args = parser.parse_args()

    image_dir = Path(args.image_dir).resolve()
    output = Path(args.output).resolve()

    scores = extract_raw_scores(image_dir)

    payload = {
        "subject": args.subject,
        "source": str(image_dir),
        "rawScores": scores,
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    count = 0
    for q_map in scores.values():
        count += len(q_map)
    print(f"Saved: {output}")
    print(json.dumps({"questionsWithScores": count}, ensure_ascii=False))


if __name__ == "__main__":
    main()
