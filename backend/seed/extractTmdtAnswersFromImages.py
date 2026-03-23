import json
import re
from pathlib import Path

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR


ROOT = Path(__file__).resolve().parents[2]
IMAGE_DIR = ROOT / "monhoc" / "_tmdt_zip"
OUT_JSON = Path(__file__).resolve().parent / "tmdt_answer_key.json"

LESSON_RE = re.compile(r"B[ÀA]I\s*(\d+)", re.IGNORECASE)
QUESTION_RE = re.compile(r"C[ÂA]U\s*(\d+)", re.IGNORECASE)
OPTION_RE = re.compile(r"^\s*([ABCD])[\.:]?\s*(.*)$", re.IGNORECASE)


def yellow_ratio(img_bgr, quad):
    points = np.array(quad, dtype=np.float32)
    x_min = max(int(points[:, 0].min()) - 2, 0)
    x_max = min(int(points[:, 0].max()) + 2, img_bgr.shape[1] - 1)
    y_min = max(int(points[:, 1].min()) - 2, 0)
    y_max = min(int(points[:, 1].max()) + 2, img_bgr.shape[0] - 1)
    if x_max <= x_min or y_max <= y_min:
        return 0.0

    crop = img_bgr[y_min:y_max, x_min:x_max]
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    lower = np.array([15, 55, 120], dtype=np.uint8)
    upper = np.array([45, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower, upper)
    return float(mask.mean() / 255.0)


def line_center_y(quad):
    points = np.array(quad, dtype=np.float32)
    return float(points[:, 1].mean())


def line_left_x(quad):
    points = np.array(quad, dtype=np.float32)
    return float(points[:, 0].min())


def normalize_text(value):
    return " ".join(str(value or "").replace("\n", " ").split()).strip()


def main():
    if not IMAGE_DIR.exists():
        raise SystemExit(f"Image folder not found: {IMAGE_DIR}")

    files = sorted(IMAGE_DIR.glob("*.jpg"))
    if not files:
        raise SystemExit(f"No JPG files found in: {IMAGE_DIR}")

    ocr = RapidOCR()

    # scores[lesson][question][option] = highlight_ratio max
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

        # Keep OCR rows in reading order.
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
                current_lesson = int(lesson_match.group(1))
                current_question = None
                current_option = None
                current_option_y = None
                current_option_x = None
                continue

            q_match = QUESTION_RE.search(cleaned)
            if q_match and current_lesson is not None:
                current_question = int(q_match.group(1))
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

            # Handle wrapped highlighted continuation lines of the same option.
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

    answer_key = {}
    strong_count = 0
    weak_count = 0

    for lesson, q_map in scores.items():
        lesson_key = answer_key.setdefault(lesson, {})
        for question, option_scores in q_map.items():
            if not option_scores:
                continue
            ranked = sorted(option_scores.items(), key=lambda kv: kv[1], reverse=True)
            best_opt, best_score = ranked[0]
            second_score = ranked[1][1] if len(ranked) > 1 else 0.0

            # Keep only confident picks where highlight is clearly above other options.
            if best_score >= 0.06 and (best_score - second_score) >= 0.03:
                lesson_key[question] = best_opt
                strong_count += 1
            else:
                weak_count += 1

    payload = {
        "source": str(IMAGE_DIR),
        "lessons": answer_key,
        "stats": {
            "lessonsDetected": len(answer_key),
            "questionsConfident": strong_count,
            "questionsWeakSkipped": weak_count,
        },
    }

    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved: {OUT_JSON}")
    print(json.dumps(payload["stats"], ensure_ascii=False))


if __name__ == "__main__":
    main()
