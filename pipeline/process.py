"""
process.py — Preprocess a calligraphy image and detect character bounding boxes.

Usage:
  python process.py --id 故書000001N000000000

Output:
  pipeline/data/processed/<identifier>/
    clean.jpg        — preprocessed image (cropped, binarized)
    boxes.json       — detected bounding boxes with confidence scores
"""

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
INDEX_FILE = DATA_DIR / "works_index.json"


def safe_filename(identifier: str) -> str:
    from urllib.parse import quote
    return quote(identifier, safe="").replace("%", "_")


# ── Index helpers ─────────────────────────────────────────────────────────────

def load_index() -> dict:
    if not INDEX_FILE.exists():
        print("ERROR: No index found. Run ingest.py --bulk or --id first.")
        sys.exit(1)
    return json.loads(INDEX_FILE.read_text(encoding="utf-8"))


def save_index(index: dict):
    INDEX_FILE.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


# ── Preprocessing ─────────────────────────────────────────────────────────────

def strip_color_bar(img: np.ndarray) -> np.ndarray:
    """Remove the NPM color calibration strip at the bottom of the image."""
    h, w = img.shape[:2]
    # Color bar is typically the bottom ~8% and contains saturated color patches
    check_height = int(h * 0.12)
    bottom_strip = img[h - check_height:, :]
    hsv = cv2.cvtColor(bottom_strip, cv2.COLOR_BGR2HSV)
    # High saturation pixels indicate color patches
    high_sat = (hsv[:, :, 1] > 80).sum()
    if high_sat > (check_height * w * 0.05):
        # Find where the color bar starts by scanning upward
        for row in range(h - 1, h - check_height - 1, -1):
            row_hsv = cv2.cvtColor(img[row:row+1, :], cv2.COLOR_BGR2HSV)
            if (row_hsv[:, :, 1] > 80).sum() > w * 0.05:
                return img[:row, :]
    return img


def isolate_text_region(img: np.ndarray) -> np.ndarray:
    """
    Detect and crop the main text block, excluding title panels
    (which have a distinctly different background tone).
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Scan vertical columns to find the main text region
    # Title/colophon panels on NPM scrolls typically have a warmer/lighter background
    # The main rubbing area is darker/greyer overall
    col_means = np.mean(gray, axis=0)
    text_cols = col_means < np.percentile(col_means, 75)

    # Find the leftmost and rightmost columns that are part of the text block
    indices = np.where(text_cols)[0]
    if len(indices) < w * 0.3:
        return img  # fallback: return full image

    left = max(0, indices[0] - 10)
    right = min(w, indices[-1] + 10)
    return img[:, left:right]


def binarize(img: np.ndarray) -> np.ndarray:
    """Convert to grayscale and apply adaptive thresholding."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Adaptive threshold handles uneven lighting and paper aging
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=10
    )
    return binary


def preprocess(img_path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Return (color_cropped, binary_cropped)."""
    img = cv2.imread(str(img_path))
    if img is None:
        raise ValueError(f"Cannot read image: {img_path}")

    img = strip_color_bar(img)
    img = isolate_text_region(img)
    binary = binarize(img)
    return img, binary


# ── Column detection ──────────────────────────────────────────────────────────

def detect_columns(binary: np.ndarray) -> list[tuple[int, int]]:
    """
    Use vertical projection to find column boundaries.
    Returns list of (x_start, x_end) for each column, right-to-left order.
    """
    h, w = binary.shape
    # Count dark pixels per column (ink = 0 in binary)
    projection = (binary == 0).sum(axis=0).astype(float)
    # Smooth to reduce noise
    kernel = np.ones(5) / 5
    projection = np.convolve(projection, kernel, mode="same")

    threshold = projection.mean() * 0.3
    in_column = False
    columns = []
    start = 0

    for x in range(w):
        if not in_column and projection[x] > threshold:
            in_column = True
            start = x
        elif in_column and projection[x] <= threshold:
            in_column = False
            if x - start > 20:  # ignore tiny noise columns
                columns.append((start, x))

    if in_column and w - start > 20:
        columns.append((start, w))

    # Calligraphy is written right-to-left
    columns.reverse()
    return columns


# ── Character detection within a column ──────────────────────────────────────

def detect_chars_in_column(binary: np.ndarray, x1: int, x2: int) -> list[tuple[int, int, int, int]]:
    """
    Use horizontal projection within a column to find character boundaries.
    Returns list of (x, y, w, h) bounding boxes, top-to-bottom.
    """
    col = binary[:, x1:x2]
    h, w = col.shape
    projection = (col == 0).sum(axis=1).astype(float)
    kernel = np.ones(3) / 3
    projection = np.convolve(projection, kernel, mode="same")

    threshold = projection.mean() * 0.2
    in_char = False
    boxes = []
    start = 0

    for y in range(h):
        if not in_char and projection[y] > threshold:
            in_char = True
            start = y
        elif in_char and projection[y] <= threshold:
            in_char = False
            char_h = y - start
            if char_h > 15:  # ignore tiny fragments
                boxes.append((x1, start, x2 - x1, char_h))

    if in_char and h - start > 15:
        boxes.append((x1, start, x2 - x1, h - start))

    return boxes


# ── PaddleOCR detection (optional enhancement) ───────────────────────────────

def detect_with_paddle(img_color: np.ndarray) -> list[dict]:
    """
    Run PaddleOCR text detection to get character-level bounding boxes.
    Falls back gracefully if PaddleOCR is not installed.
    """
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)
        result = ocr.ocr(img_color, cls=False)
        boxes = []
        if result and result[0]:
            for line in result[0]:
                pts = line[0]  # 4 corner points
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                x, y = int(min(xs)), int(min(ys))
                w = int(max(xs) - min(xs))
                h = int(max(ys) - min(ys))
                conf = float(line[1][1]) if line[1] else 0.5
                boxes.append({"x": x, "y": y, "w": w, "h": h, "confidence": conf, "source": "paddle"})
        return boxes
    except ImportError:
        return []


# ── Main processing ───────────────────────────────────────────────────────────

def process_work(identifier: str):
    index = load_index()
    entry = index.get(identifier)
    if not entry:
        print(f"ERROR: {identifier} not in index. Run ingest.py --id first.")
        sys.exit(1)

    safe = safe_filename(identifier)
    img_path = next(
        (p for p in [RAW_DIR / f"{safe}.jpg", RAW_DIR / f"{identifier}.jpg"] if p.exists()),
        None,
    )
    if not img_path:
        print(f"ERROR: Image not found in {RAW_DIR}. Run ingest.py --id first.")
        sys.exit(1)

    out_dir = PROCESSED_DIR / safe
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Processing: {entry['name']}")

    # Step 1: Preprocess
    print("  [1/4] Preprocessing...")
    img_color, binary = preprocess(img_path)
    cv2.imwrite(str(out_dir / "clean.jpg"), img_color)
    cv2.imwrite(str(out_dir / "binary.jpg"), binary)

    # Step 2: Projection-based detection
    print("  [2/4] Detecting columns...")
    columns = detect_columns(binary)
    print(f"        Found {len(columns)} columns")

    projection_boxes = []
    for x1, x2 in columns:
        chars = detect_chars_in_column(binary, x1, x2)
        for (x, y, w, h) in chars:
            projection_boxes.append({"x": x, "y": y, "w": w, "h": h, "confidence": 0.6, "source": "projection"})

    # Step 3: PaddleOCR detection
    print("  [3/4] Running PaddleOCR detection...")
    paddle_boxes = detect_with_paddle(img_color)
    if paddle_boxes:
        print(f"        PaddleOCR found {len(paddle_boxes)} regions")
    else:
        print("        PaddleOCR not available — using projection only")

    # Step 4: Merge and align with 釋文
    all_boxes = paddle_boxes if paddle_boxes else projection_boxes
    # Sort top-to-bottom, right-to-left (standard calligraphy reading order)
    all_boxes.sort(key=lambda b: (-(b["x"] + b["w"] // 2), b["y"]))

    shiwen = entry.get("shiwen") or ""
    shiwen_chars = [c for c in shiwen if c.strip() and c not in "。，、；：「」『』【】〔〕…—"]

    result = {
        "identifier": identifier,
        "name": entry["name"],
        "imageSize": {"w": img_color.shape[1], "h": img_color.shape[0]},
        "columnCount": len(columns),
        "boxCount": len(all_boxes),
        "shiwenCount": len(shiwen_chars),
        "countMatch": len(all_boxes) == len(shiwen_chars),
        "boxes": all_boxes,
        "shiwen": shiwen_chars,
    }

    if not result["countMatch"]:
        print(f"  ⚠  Box count ({len(all_boxes)}) ≠ 釋文 count ({len(shiwen_chars)}) — review needed")
    else:
        print(f"  ✓  {len(all_boxes)} boxes match {len(shiwen_chars)} 釋文 characters")

    boxes_file = out_dir / "boxes.json"
    boxes_file.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    entry["status"] = "processing"
    entry["updatedAt"] = __import__("datetime").datetime.now().isoformat(timespec="seconds")
    index[identifier] = entry
    save_index(index)

    print(f"\n✓ Output: {out_dir}")
    print(f"  clean.jpg  — preprocessed image")
    print(f"  boxes.json — {len(all_boxes)} bounding boxes")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Process a calligraphy image")
    parser.add_argument("--id", required=True, metavar="IDENTIFIER", help="文物統一編號")
    args = parser.parse_args()
    process_work(args.id)


if __name__ == "__main__":
    main()
