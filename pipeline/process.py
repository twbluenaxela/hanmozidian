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
import os
import sys
from pathlib import Path

# Disable onednn (MKL-DNN) which is unsupported on this system
os.environ.setdefault("FLAGS_use_mkldnn", "0")

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

def _strip_is_colorful(region: np.ndarray) -> bool:
    """Return True if the region contains NPM colour-calibration patches."""
    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    high_sat = (hsv[:, :, 1] > 80).sum()
    col_std = float(np.std(np.mean(gray, axis=0).astype(float)))
    return (
        high_sat > (h * w * 0.05)
        or col_std > 30
    )


def strip_color_bar(img: np.ndarray) -> np.ndarray:
    """Remove NPM colour calibration strips — bottom-mounted or right-mounted."""
    h, w = img.shape[:2]

    # ── Bottom strip ──────────────────────────────────────────────────────────
    check_h = int(h * 0.15)
    if _strip_is_colorful(img[h - check_h:, :]):
        cutline = h
        for row in range(h - 1, h - check_h - 1, -1):
            row_hsv = cv2.cvtColor(img[row:row+1, :], cv2.COLOR_BGR2HSV)
            row_gray = cv2.cvtColor(img[row:row+1, :], cv2.COLOR_BGR2GRAY)[0].astype(float)
            if (row_hsv[:, :, 1] > 80).sum() > w * 0.05 or float(row_gray.std()) > 30:
                cutline = row
        img = img[:cutline, :]
        h = img.shape[0]

    # ── Right strip ───────────────────────────────────────────────────────────
    check_w = int(w * 0.25)
    if _strip_is_colorful(img[:, w - check_w:]):
        cutcol = w
        for col in range(w - 1, w - check_w - 1, -1):
            col_hsv = cv2.cvtColor(img[:, col:col+1], cv2.COLOR_BGR2HSV)
            col_gray = cv2.cvtColor(img[:, col:col+1], cv2.COLOR_BGR2GRAY)[:, 0].astype(float)
            if (col_hsv[:, :, 1] > 80).sum() > h * 0.05 or float(col_gray.std()) > 30:
                cutcol = col
        img = img[:, :cutcol]

    return img


def isolate_text_region(img: np.ndarray) -> np.ndarray:
    """
    Detect and crop the main text block, excluding title panels
    (which have a distinctly different background tone).
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    col_means = np.mean(gray, axis=0)
    text_cols = col_means < np.percentile(col_means, 75)

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

    threshold = projection.mean() * 0.6
    # Require this many consecutive low-ink columns before closing a column,
    # preventing a single noisy stroke from splitting a real column.
    MIN_GAP = 8
    max_col_width = w // 4

    in_column = False
    columns = []
    start = 0
    gap_count = 0

    for x in range(w):
        if not in_column:
            if projection[x] > threshold:
                in_column = True
                gap_count = 0
                start = x
        else:
            if projection[x] <= threshold:
                gap_count += 1
                if gap_count >= MIN_GAP:
                    col_end = x - gap_count + 1
                    if col_end - start > 20:
                        columns.append((start, col_end))
                    in_column = False
                    gap_count = 0
            else:
                gap_count = 0
                if (x - start) > max_col_width:
                    # Wide region — split at the local minimum within the window
                    window = projection[start:x]
                    split = int(np.argmin(window)) + start
                    columns.append((start, split))
                    start = split

    if in_column and w - start > 20:
        columns.append((start, w))

    # Discard edge artifacts narrower than 3% of image width
    min_col_w = max(15, w // 30)
    columns = [(x1, x2) for x1, x2 in columns if min_col_w <= (x2 - x1) <= max_col_width]

    # Calligraphy is written right-to-left
    columns.reverse()
    return columns


# ── Character detection within a column ──────────────────────────────────────

def _split_blob(mask: np.ndarray) -> list[tuple[int, int, int, int]]:
    """
    Split an oversized blob at the row with minimum ink — the gap between two characters.
    Avoids the top/bottom 15% to prevent splitting at a stroke edge.
    """
    h, w = mask.shape
    projection = (mask > 0).sum(axis=1).astype(float)
    margin = max(8, h // 6)
    search_region = projection[margin: h - margin]
    if len(search_region) == 0:
        return [(0, 0, w, h)]
    split = int(np.argmin(search_region)) + margin
    parts = []
    if split > 10:
        parts.append((0, 0, w, split))
    if h - split > 10:
        parts.append((0, split, w, h - split))
    return parts if parts else [(0, 0, w, h)]


def detect_chars_in_column(binary: np.ndarray, x1: int, x2: int, close_kernel_h: int = 6) -> list[tuple[int, int, int, int]]:
    """
    Connected-components character detection within a column strip.
    Uses morphological closing to bridge stroke gaps within a character,
    then splits oversized blobs (touching chars) with watershed.
    Returns list of (x, y, w, h) bounding boxes, top-to-bottom.
    """
    col = binary[:, x1:x2]
    h, w = col.shape

    inv = cv2.bitwise_not(col)
    # Narrow width avoids bleeding across column boundaries;
    # tall height connects vertical stroke fragments within one character.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, close_kernel_h))
    closed = cv2.morphologyEx(inv, cv2.MORPH_CLOSE, kernel)

    num_labels, label_map, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)

    max_char_h = max(30, int(h * 0.35))
    min_area = max(150, int((w * 0.1) ** 2))

    boxes: list[tuple[int, int, int, int]] = []
    for i in range(1, num_labels):
        bx, by, bw, bh, area = stats[i]
        if area < min_area:
            continue
        if bh > max_char_h:
            # Blob spans more than one character — split at the minimum-ink row
            blob_mask = closed[by:by+bh, bx:bx+bw].astype(np.uint8)
            for sx, sy, sw, sh in _split_blob(blob_mask):
                boxes.append((int(x1 + bx + sx), int(by + sy), int(sw), int(sh)))
        else:
            boxes.append((int(x1 + bx), int(by), int(bw), int(bh)))

    boxes.sort(key=lambda b: b[1])
    return boxes


# ── Global box filter ─────────────────────────────────────────────────────────

def _is_plausible_char_box(b: dict) -> bool:
    """Reject boxes with extreme aspect ratios or negligible area."""
    bw, bh = b["w"], b["h"]
    if bw * bh < 200:
        return False
    if bw / bh > 2.5:   # wider than tall — horizontal artifact
        return False
    if bh / bw > 5.0:   # very tall sliver — vertical stroke noise
        return False
    return True


# ── PaddleOCR detection (optional enhancement) ───────────────────────────────

def detect_with_paddle(img_color: np.ndarray) -> list[dict]:
    """
    Run PaddleOCR text detection to get character-level bounding boxes.
    Falls back gracefully if PaddleOCR is not installed.
    """
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_textline_orientation=False, lang="ch", enable_mkldnn=False)
        results = ocr.predict(img_color)
        boxes = []
        for res in results:
            polys = res.get("dt_polys", [])
            scores = res.get("rec_scores", [])
            for i, pts in enumerate(polys):
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                x, y = int(min(xs)), int(min(ys))
                w = int(max(xs) - min(xs))
                h = int(max(ys) - min(ys))
                conf = float(scores[i]) if i < len(scores) else 0.5
                boxes.append({"x": x, "y": y, "w": w, "h": h, "confidence": conf, "source": "paddle"})
        return boxes
    except Exception as e:
        print(f"  PaddleOCR unavailable ({type(e).__name__}: {e}), falling back to projection")
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
    print("  [1/3] Preprocessing...")
    img_color, binary = preprocess(img_path)
    cv2.imwrite(str(out_dir / "clean.jpg"), img_color)
    cv2.imwrite(str(out_dir / "binary.jpg"), binary)

    # Step 2: Column + character detection
    print("  [2/3] Detecting columns and characters...")
    columns = detect_columns(binary)
    print(f"        Found {len(columns)} columns")

    cv_boxes = []
    for x1, x2 in columns:
        chars = detect_chars_in_column(binary, x1, x2)
        for (x, y, w, h) in chars:
            cv_boxes.append({"x": x, "y": y, "w": w, "h": h, "confidence": 0.7, "source": "opencv"})

    before = len(cv_boxes)
    cv_boxes = [b for b in cv_boxes if _is_plausible_char_box(b)]
    if len(cv_boxes) < before:
        print(f"        Filtered {before - len(cv_boxes)} implausible boxes")

    # Step 3: Merge and align with 釋文
    all_boxes = cv_boxes
    # Sort right-to-left by column centre, then top-to-bottom within each column
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
