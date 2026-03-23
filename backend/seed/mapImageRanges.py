import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR

from extractAnswersFromImages import LESSON_RE, QUESTION_RE, line_center_y, line_left_x, normalize_text, parse_ocr_number


def summarize(image_dir: Path):
    files = sorted(list(image_dir.glob("*.jpg")) + list(image_dir.glob("*.jpeg")) + list(image_dir.glob("*.png")))
    if not files:
        raise SystemExit(f"No image files in {image_dir}")

    ocr = RapidOCR()
    current_lesson = None
    out = []

    for file in files:
        raw = np.fromfile(str(file), dtype=np.uint8)
        img = cv2.imdecode(raw, cv2.IMREAD_COLOR)
        if img is None:
            continue

        result, _ = ocr(img)
        lessons = set()
        qs = []

        if result:
            rows = sorted(result, key=lambda item: (line_center_y(item[0]), line_left_x(item[0])))
            for _quad, text, _conf in rows:
                cleaned = normalize_text(text)
                if not cleaned:
                    continue

                lm = LESSON_RE.search(cleaned)
                if lm:
                    ln = parse_ocr_number(lm.group(1))
                    if ln is not None and 1 <= ln <= 12:
                        current_lesson = ln
                        lessons.add(ln)

                qm = QUESTION_RE.search(cleaned)
                if qm:
                    qn = parse_ocr_number(qm.group(1))
                    if qn is not None and 1 <= qn <= 40:
                        qs.append(qn)

        effective_lesson = None
        if lessons:
            effective_lesson = sorted(list(lessons))[0]
        elif current_lesson is not None:
            effective_lesson = current_lesson

        out.append(
            {
                "file": file.name,
                "lesson": effective_lesson,
                "lessonsDetected": sorted(list(lessons)),
                "qMin": min(qs) if qs else None,
                "qMax": max(qs) if qs else None,
                "qCount": len(qs),
            }
        )

    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image-dir", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    image_dir = Path(args.image_dir).resolve()
    output = Path(args.output).resolve()

    data = summarize(image_dir)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved: {output}")


if __name__ == "__main__":
    main()
