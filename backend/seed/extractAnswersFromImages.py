import argparse
import json
import re
from pathlib import Path

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR


LESSON_RE = re.compile(r"B[ÀA]I\s*([0-9OQDISl\|]+)", re.IGNORECASE)
QUESTION_RE = re.compile(r"C[ÂA]U\s*([0-9OQDISl\|]+)", re.IGNORECASE)
OPTION_RE = re.compile(r"^\s*[\(\[]?\s*([ABCD])\s*[\)\]\.:\-/]?\s*(.*)$", re.IGNORECASE)


def parse_ocr_number(token):
    value = str(token or "").strip()
    if not value:
        return None

    normalized = (
        value.replace("O", "0")
        .replace("o", "0")
        .replace("Q", "0")
        .replace("D", "0")
        .replace("I", "1")
        .replace("l", "1")
        .replace("|", "1")
        .replace("S", "5")
    )

    normalized = re.sub(r"[^0-9]", "", normalized)
    if not normalized:
        return None

    try:
        return int(normalized)
    except ValueError:
        return None


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


def extract_answer_key(image_dir: Path, min_best: float, min_gap: float):
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
                if lesson_no is None:
                    continue

                if lesson_no < 1 or lesson_no > 12:
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
                if next_question is None:
                    continue

                if next_question < 1 or next_question > 40:
                    continue

                # If lesson heading OCR is missed, infer a new lesson when question index resets.
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

            if best_score >= min_best and (best_score - second_score) >= min_gap:
                lesson_key[question] = best_opt
                strong_count += 1
            else:
                weak_count += 1

    return {
        "lessons": answer_key,
        "stats": {
            "lessonsDetected": len(answer_key),
            "questionsConfident": strong_count,
            "questionsWeakSkipped": weak_count,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Extract highlighted correct options from answer images.")
    parser.add_argument("--image-dir", required=True, help="Path to folder containing image pages.")
    parser.add_argument("--output", required=True, help="Output JSON answer-key path.")
    parser.add_argument("--subject", default="", help="Subject code/name for metadata.")
    parser.add_argument("--min-best", type=float, default=0.06, help="Minimum highlight ratio to accept best option.")
    parser.add_argument("--min-gap", type=float, default=0.03, help="Minimum gap between best and second option.")
    args = parser.parse_args()

    image_dir = Path(args.image_dir).resolve()
    output_file = Path(args.output).resolve()

    if not image_dir.exists():
        raise SystemExit(f"Image folder not found: {image_dir}")

    extracted = extract_answer_key(image_dir, args.min_best, args.min_gap)

    sorted_lessons = {}
    for lesson_no in sorted(extracted["lessons"].keys(), key=lambda x: int(x)):
        q_map = extracted["lessons"][lesson_no]
        sorted_lessons[lesson_no] = {
            q_no: q_map[q_no] for q_no in sorted(q_map.keys(), key=lambda x: int(x))
        }

    payload = {
        "source": str(image_dir),
        "subject": args.subject,
        "lessons": sorted_lessons,
        "stats": extracted["stats"],
    }

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Saved: {output_file}")
    print(json.dumps(payload["stats"], ensure_ascii=False))


if __name__ == "__main__":
    main()