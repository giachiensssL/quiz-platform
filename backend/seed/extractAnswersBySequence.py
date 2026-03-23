import argparse
import json
import re
from pathlib import Path

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR

LESSON_RE = re.compile(r"B[ÀA]I\s*([0-9OQDISl\|]+)", re.IGNORECASE)
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
    lower = np.array([15, 50, 110], dtype=np.uint8)
    upper = np.array([48, 255, 255], dtype=np.uint8)
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


def extract_sequence(image_dir: Path, min_highlight: float):
    files = sorted(list(image_dir.glob("*.jpg")) + list(image_dir.glob("*.jpeg")) + list(image_dir.glob("*.png")))
    if not files:
        raise SystemExit(f"No image files found in: {image_dir}")

    ocr = RapidOCR()
    events = {}
    current_lesson = None

    for file_idx, file in enumerate(files):
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

            lesson_match = LESSON_RE.search(cleaned)
            if lesson_match:
                lesson_no = parse_ocr_number(lesson_match.group(1))
                if lesson_no is not None and 1 <= lesson_no <= 12:
                    current_lesson = lesson_no
                continue

            if current_lesson is None:
                continue

            opt_match = OPTION_RE.match(cleaned)
            if not opt_match:
                continue

            ratio = yellow_ratio(img, quad)
            if ratio < min_highlight:
                continue

            opt = opt_match.group(1).upper()
            y = line_center_y(quad)
            x = line_left_x(quad)

            bucket = events.setdefault(str(current_lesson), [])
            # Deduplicate near-duplicate OCR lines for the same rendered line.
            if bucket:
                prev = bucket[-1]
                if (
                    prev["file_idx"] == file_idx
                    and abs(prev["y"] - y) <= 24
                ):
                    if ratio > prev["score"]:
                        prev["option"] = opt
                        prev["score"] = ratio
                        prev["y"] = y
                        prev["x"] = x
                        prev["file"] = file.name
                    continue

            bucket.append({
                "option": opt,
                "score": ratio,
                "file_idx": file_idx,
                "y": y,
                "x": x,
                "file": file.name,
            })

    return events


def main():
    parser = argparse.ArgumentParser(description="Extract answers by highlight sequence per lesson.")
    parser.add_argument("--image-dir", required=True, help="Path to folder containing image pages.")
    parser.add_argument("--output", required=True, help="Output JSON path.")
    parser.add_argument("--subject", default="", help="Subject code/name.")
    parser.add_argument("--min-highlight", type=float, default=0.055, help="Minimum highlight ratio for option lines.")
    args = parser.parse_args()

    image_dir = Path(args.image_dir).resolve()
    output_file = Path(args.output).resolve()

    events = extract_sequence(image_dir, args.min_highlight)
    payload = {
        "source": str(image_dir),
        "subject": args.subject,
        "eventsByLesson": events,
    }

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {lesson: len(items) for lesson, items in events.items()}
    print(f"Saved: {output_file}")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
