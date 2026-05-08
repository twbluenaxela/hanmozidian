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
    """Return True if the region contains NPM colour-calibration patches (Macbeth / gradient bar)."""
    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    h, w = region.shape[:2]
    high_sat = (hsv[:, :, 1] > 80).sum()
    return high_sat > (h * w * 0.05)


def strip_color_bar(img: np.ndarray) -> np.ndarray:
    """Remove NPM colour calibration strips — bottom-mounted or right-mounted."""
    h, w = img.shape[:2]

    # Only check the last 5% — enough for a real calibration strip but
    # won't reach up into the bottom row of characters.
    check_h = max(10, int(h * 0.05))
    if _strip_is_colorful(img[h - check_h:, :]):
        cutline = h
        for row in range(h - 1, h - check_h - 1, -1):
            row_hsv = cv2.cvtColor(img[row:row+1, :], cv2.COLOR_BGR2HSV)
            if (row_hsv[:, :, 1] > 80).sum() > w * 0.05:
                cutline = row
        img = img[:cutline, :]
        h = img.shape[0]

    check_w = max(10, int(w * 0.05))
    if _strip_is_colorful(img[:, w - check_w:]):
        cutcol = w
        for col in range(w - 1, w - check_w - 1, -1):
            col_hsv = cv2.cvtColor(img[:, col:col+1], cv2.COLOR_BGR2HSV)
            if (col_hsv[:, :, 1] > 80).sum() > h * 0.05:
                cutcol = col
        img = img[:, :cutcol]

    return img


def _longest_active_run(active: np.ndarray) -> tuple[int, int]:
    """Return (start, length) of the longest contiguous True run in a 1-D boolean array."""
    best_start, best_len = 0, 0
    cur_start, cur_len = 0, 0
    for i, val in enumerate(active):
        if val:
            if cur_len == 0:
                cur_start = i
            cur_len += 1
            if cur_len > best_len:
                best_len, best_start = cur_len, cur_start
        else:
            cur_len = 0
    return best_start, best_len


def isolate_text_region(img: np.ndarray) -> np.ndarray:
    """
    Crop horizontally to the scroll paper using column std deviation.
    High std = ink contrast = text. Low std = uniform border (dark mount
    or light mat — doesn't matter, both have low variance).
    No vertical crop — that caused bottom-row losses.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    col_std = np.std(gray.astype(float), axis=0)
    kernel = np.ones(30) / 30
    smoothed = np.convolve(col_std, kernel, mode="same")
    active = smoothed > np.percentile(smoothed, 40)

    best_start, best_len = _longest_active_run(active)

    if best_len < w * 0.15:
        return img  # unusual image — return as-is

    left  = max(0, best_start - 5)
    right = min(w, best_start + best_len + 5)
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


def mask_red_ink(img: np.ndarray) -> np.ndarray:
    """
    Replace red/orange pixels (seals, stamps) with white so they are
    invisible to the binarizer and don't get detected as characters.
    Seals in Chinese calligraphy are almost always vermillion/red ink.
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # Red wraps around hue=0: low range 0-15, high range 165-180
    mask_low  = cv2.inRange(hsv, (0,   80, 60), (15,  255, 255))
    mask_high = cv2.inRange(hsv, (165, 80, 60), (180, 255, 255))
    red_mask  = cv2.bitwise_or(mask_low, mask_high)
    # Dilate slightly to catch anti-aliased edges around seal strokes
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    red_mask = cv2.dilate(red_mask, kernel, iterations=1)
    result = img.copy()
    result[red_mask > 0] = 255
    return result


def preprocess(img_path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Return (color_cropped, binary_cropped)."""
    img = cv2.imread(str(img_path))
    if img is None:
        raise ValueError(f"Cannot read image: {img_path}")

    img = strip_color_bar(img)
    img = isolate_text_region(img)
    masked = mask_red_ink(img)
    binary = binarize(masked)
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

    # Border lines (scroll edge, ruler lines) show as solid vertical bands where
    # projection ≈ h (nearly every row is dark). Exclude them from the threshold
    # calculation so they don't inflate the mean and hide real text columns.
    text_proj = projection[projection < h * 0.75]
    if len(text_proj) < w * 0.1:
        text_proj = projection  # unusual image — fall back to full mean
    threshold = text_proj.mean() * 0.6

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

def _split_blob_recursive(
    orig: np.ndarray, max_h: int, depth: int = 0
) -> list[tuple[int, int, int, int]]:
    """
    Recursively split an oversized blob at the row with minimum ink.
    `orig` is the pre-closing inverted image — gaps are real gaps there,
    not filled in by morphological closing.
    Stops when each piece is under max_h or recursion depth reaches 4.
    """
    h, w = orig.shape
    if h <= max_h or depth >= 4:
        return [(0, 0, w, h)]

    projection = (orig > 0).sum(axis=1).astype(float)
    # Avoid the outer 10% so we don't split right at a stroke edge.
    margin = max(5, h // 10)
    search = projection[margin: h - margin]
    if len(search) == 0:
        return [(0, 0, w, h)]

    split = int(np.argmin(search)) + margin

    if split < 5 or h - split < 5:
        return [(0, 0, w, h)]

    top_parts = _split_blob_recursive(orig[:split, :], max_h, depth + 1)
    bot_parts = _split_blob_recursive(orig[split:, :], max_h, depth + 1)

    result = list(top_parts)
    result += [(x, split + y, sw, sh) for x, y, sw, sh in bot_parts]
    return result


def detect_chars_in_column(binary: np.ndarray, x1: int, x2: int, close_kernel_h: int = 6, split_ratio: float = 1.5) -> list[tuple[int, int, int, int]]:
    """
    Connected-components character detection within a column strip.
    Returns list of (x, y, w, h) bounding boxes, top-to-bottom.
    """
    col = binary[:, x1:x2]
    h, w = col.shape

    inv = cv2.bitwise_not(col)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (6, close_kernel_h))
    closed = cv2.morphologyEx(inv, cv2.MORPH_CLOSE, kernel)

    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)

    min_area = max(150, int((w * 0.1) ** 2))

    blobs = []
    for i in range(1, num_labels):
        bx, by, bw, bh, area = stats[i]
        if area < min_area:
            continue
        # Seal frames are large but hollow — ink fills only the border.
        # Compute ink density on the *original* (pre-close) inv strip so
        # closing doesn't inflate density artificially.
        blob_inv = inv[by:by+bh, bx:bx+bw]
        density = float((blob_inv > 0).sum()) / max(1, bw * bh)
        if density < 0.06 and bw * bh > min_area * 4:
            continue  # hollow frame — skip
        blobs.append((int(bx), int(by), int(bw), int(bh)))

    if not blobs:
        return []

    # Use median blob height as the reference for a single character.
    # Anything taller than 1.5× median is likely two or more merged characters.
    median_h = float(np.median([bh for _, _, _, bh in blobs]))
    max_char_h = max(20, int(median_h * split_ratio))

    boxes: list[tuple[int, int, int, int]] = []
    for bx, by, bw, bh in blobs:
        if bh > max_char_h:
            # Use the original (pre-close) strip to find split points —
            # the closed image has the inter-character gap filled in,
            # making the minimum ambiguous.
            orig_blob = inv[by:by+bh, bx:bx+bw]
            for sx, sy, sw, sh in _split_blob_recursive(orig_blob, max_char_h):
                boxes.append((int(x1 + bx + sx), int(by + sy), int(sw), int(sh)))
        else:
            boxes.append((int(x1 + bx), int(by), int(bw), int(bh)))

    boxes.sort(key=lambda b: b[1])
    return boxes


# ── Force-split by expected character count ───────────────────────────────────

def force_split_column(
    binary: np.ndarray, x1: int, x2: int, n_chars: int
) -> list[tuple[int, int, int, int]]:
    """
    Divide a column into n_chars boxes using horizontal projection minima.
    First tries to find n_chars natural split points; falls back to equal height.
    Used when connected strokes prevent connected-component detection.
    """
    if n_chars <= 0:
        return []
    col = binary[:, x1:x2]
    h, w = col.shape

    # Equal-height fallback is always available
    def equal_split() -> list[tuple[int, int, int, int]]:
        seg = h / n_chars
        return [(x1, int(i * seg), x2 - x1, max(1, int((i + 1) * seg) - int(i * seg))) for i in range(n_chars)]

    if n_chars == 1:
        return [(x1, 0, x2 - x1, h)]

    # Smooth horizontal projection and find n_chars-1 best valley positions
    proj = (col == 255).sum(axis=1).astype(float)  # white pixels per row (inv of ink)
    ksize = max(3, h // (n_chars * 4))
    smooth = np.convolve(proj, np.ones(ksize) / ksize, mode="same")

    # Divide into n_chars zones and pick the minimum inside each zone boundary
    splits = [0]
    for i in range(1, n_chars):
        zone_start = int(h * i / n_chars) - h // (n_chars * 2)
        zone_end   = int(h * i / n_chars) + h // (n_chars * 2)
        zone_start = max(0, zone_start)
        zone_end   = min(h - 1, zone_end)
        if zone_end <= zone_start:
            continue
        local_min = int(np.argmin(smooth[zone_start:zone_end])) + zone_start
        splits.append(local_min)
    splits.append(h)

    boxes = []
    for i in range(len(splits) - 1):
        y1, y2 = splits[i], splits[i + 1]
        if y2 - y1 < 2:
            continue
        boxes.append((x1, y1, x2 - x1, y2 - y1))

    return boxes if len(boxes) == n_chars else equal_split()


# ── Horizontal stroke expansion ──────────────────────────────────────────────

def expand_boxes_horizontally(
    binary: np.ndarray,
    boxes: list[dict],
    max_expand: int = 35,
    min_density: float = 0.06,
) -> list[dict]:
    """
    Grow each box left/right to capture strokes that extend past the column
    boundary (e.g. 寒's 捺, 饒's 撇).

    Scans column-by-column outward from the box edge and stops at the first
    column whose ink density (dark pixels / box height) drops below min_density.
    This means a real stroke (consistent ink) keeps expanding, while paper
    texture noise (sparse, non-consecutive) stops the expansion immediately.
    """
    img_h, img_w = binary.shape
    expanded = []

    for b in boxes:
        bx, by, bw, bh = b["x"], b["y"], b["w"], b["h"]
        y1 = max(0, by)
        y2 = min(img_h, by + bh)
        if y2 <= y1:
            expanded.append(b)
            continue

        strip_h = y2 - y1
        min_px = max(2, int(strip_h * min_density))

        # Expand right: walk outward, stop at first thin column
        right_exp = 0
        for dx in range(1, max_expand + 1):
            x = bx + bw - 1 + dx
            if x >= img_w:
                break
            if (binary[y1:y2, x] == 0).sum() >= min_px:
                right_exp = dx
            else:
                break

        # Expand left
        left_exp = 0
        for dx in range(1, max_expand + 1):
            x = bx - dx
            if x < 0:
                break
            if (binary[y1:y2, x] == 0).sum() >= min_px:
                left_exp = dx
            else:
                break

        expanded.append({**b, "x": bx - left_exp, "w": bw + left_exp + right_exp})

    return expanded


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


# ── Debug visualisation ───────────────────────────────────────────────────────

def save_debug_image(
    img_color: np.ndarray,
    binary: np.ndarray,
    columns: list[tuple[int, int]],
    boxes: list[dict],
    shiwen_chars: list[str],
    out_path: Path,
):
    """
    Save a side-by-side debug image:
      Left  — clean colour image with detected boxes + 釋文 labels
      Right — binary image with column boundaries
    """
    h, w = img_color.shape[:2]
    SCALE = 2  # draw at 2× so text is readable
    vis_color = cv2.resize(img_color, (w * SCALE, h * SCALE), interpolation=cv2.INTER_LINEAR)
    vis_bin   = cv2.cvtColor(cv2.resize(binary, (w * SCALE, h * SCALE), interpolation=cv2.INTER_NEAREST), cv2.COLOR_GRAY2BGR)

    COL_COLORS = [(255, 80, 80), (80, 200, 80), (80, 80, 255), (200, 200, 0), (0, 200, 200)]

    # Draw column bands on both panels
    for ci, (x1, x2) in enumerate(columns):
        color = COL_COLORS[ci % len(COL_COLORS)]
        cv2.rectangle(vis_color, (x1*SCALE, 0), (x2*SCALE, h*SCALE), color, 1)
        cv2.rectangle(vis_bin,   (x1*SCALE, 0), (x2*SCALE, h*SCALE), color, 1)

    # Draw boxes + 釋文 labels on the colour panel
    # boxes are sorted right-to-left, top-to-bottom — same order as shiwen_chars
    for idx, b in enumerate(boxes):
        bx, by, bw, bh = b["x"], b["y"], b["w"], b["h"]
        # colour by source
        if b.get("source") == "force-split":
            rect_color = (0, 165, 255)   # orange
        else:
            rect_color = (0, 220, 0)     # green

        cv2.rectangle(vis_color, (bx*SCALE, by*SCALE), ((bx+bw)*SCALE, (by+bh)*SCALE), rect_color, 1)

        char = shiwen_chars[idx] if idx < len(shiwen_chars) else "?"
        label = f"{idx+1} {char}"
        cv2.putText(vis_color, label,
                    (bx*SCALE + 2, by*SCALE + 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 200), 1, cv2.LINE_AA)

    # Stitch panels side by side
    gap = np.full((h * SCALE, 4, 3), 128, dtype=np.uint8)
    combined = np.hstack([vis_color, gap, vis_bin])
    cv2.imwrite(str(out_path), combined)
    print(f"  Debug image saved → {out_path}")


# ── Main processing ───────────────────────────────────────────────────────────

def process_work(identifier: str, force_split: bool = False, debug: bool = False,
                 close_kernel: int = 6, split_ratio: float = 1.5):
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

    shiwen = entry.get("shiwen") or ""
    shiwen_chars = [c for c in shiwen if c.strip() and c not in "。，、；：「」『』【】〔〕…—"]

    # Step 1: Preprocess
    print("  [1/3] Preprocessing...")
    img_color, binary = preprocess(img_path)
    cv2.imwrite(str(out_dir / "clean.jpg"), img_color)
    cv2.imwrite(str(out_dir / "binary.jpg"), binary)

    # Step 2: Column + character detection
    print("  [2/3] Detecting columns and characters...")
    columns = detect_columns(binary)
    print(f"        Found {len(columns)} columns")

    expected_total = len(shiwen_chars)
    # chars_per_col used by --force-split only
    chars_per_col = (expected_total // len(columns)) if (columns and expected_total) else 0

    cv_boxes = []
    # columns is already right-to-left, so col_idx 0 = rightmost column
    for col_idx, (x1, x2) in enumerate(columns):
        chars = detect_chars_in_column(binary, x1, x2, close_kernel_h=close_kernel, split_ratio=split_ratio)
        for (x, y, w, h) in chars:
            cv_boxes.append({"x": x, "y": y, "w": w, "h": h, "confidence": 0.7, "source": "opencv", "_col": col_idx})

    before = len(cv_boxes)
    cv_boxes = [b for b in cv_boxes if _is_plausible_char_box(b)]
    if len(cv_boxes) < before:
        print(f"        Filtered {before - len(cv_boxes)} implausible boxes")

    # Sort by column index (right-to-left), then top-to-bottom within the column.
    # Using the detected column index instead of box centre avoids wide strokes
    # pushing a box's centre into the wrong column's range.
    cv_boxes.sort(key=lambda b: (b["_col"], b["y"]))
    cv_boxes = expand_boxes_horizontally(binary, cv_boxes)

    # Strip internal column tag before writing to JSON
    for b in cv_boxes:
        b.pop("_col", None)

    # Add a small uniform padding so tight bounding boxes don't clip stroke
    # tips like 點 or the very corners of 寒/歸. Clamp to image bounds.
    img_h, img_w = binary.shape
    PAD = 4
    for b in cv_boxes:
        b["x"] = max(0, b["x"] - PAD)
        b["y"] = max(0, b["y"] - PAD)
        b["w"] = min(img_w - b["x"], b["w"] + PAD * 2)
        b["h"] = min(img_h - b["y"], b["h"] + PAD * 2)

    # Force-split: only when explicitly requested (--force-split / UI button).
    # Divide each column into equal segments by 釋文 count.
    # This handles 行書/草書 where strokes connect and confuse connected components.
    if force_split and chars_per_col > 0 and columns:
        print(f"        CV boxes={len(cv_boxes)}, expected={expected_total} — trying force-split…")
        forced_boxes = []
        for i, (x1, x2) in enumerate(columns):
            # Give any remainder chars to the last column
            n = chars_per_col + (expected_total % len(columns) if i == len(columns) - 1 else 0)
            for (x, y, w, h) in force_split_column(binary, x1, x2, n):
                forced_boxes.append({"x": x, "y": y, "w": w, "h": h, "confidence": 0.5, "source": "force-split"})
        if len(forced_boxes) == expected_total:
            print(f"        Force-split produced {len(forced_boxes)} boxes ✓")
            cv_boxes = forced_boxes
        else:
            print(f"        Force-split gave {len(forced_boxes)}, keeping CV result")

    # Step 3: Merge and align with 釋文
    all_boxes = cv_boxes
    # Already sorted before expansion — preserve that order.

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

    if debug:
        save_debug_image(img_color, binary, columns, all_boxes, shiwen_chars, out_dir / "debug.jpg")

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
    parser.add_argument("--force-split", action="store_true",
        help="Force equal-height box split by 釋文 count (行書/草書 with connected strokes)")
    parser.add_argument("--debug", action="store_true",
        help="Save debug.jpg with detected columns and boxes overlaid")
    parser.add_argument("--close-kernel", type=int, default=6, metavar="N",
        help="筆畫黏合 — morphological closing kernel height (1-15, default 6). "
             "Higher = more stroke fragments joined; lower = less merging.")
    parser.add_argument("--split-ratio", type=float, default=1.5, metavar="X",
        help="分割靈敏度 — split any blob taller than X × median char height (default 1.5). "
             "Lower = split more aggressively.")
    args = parser.parse_args()
    process_work(args.id, force_split=args.force_split, debug=args.debug,
                 close_kernel=args.close_kernel, split_ratio=args.split_ratio)


if __name__ == "__main__":
    main()
