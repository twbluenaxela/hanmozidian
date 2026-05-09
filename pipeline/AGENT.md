# pipeline/process.py — Agent Context

Architecture, decisions, and gotchas for the OpenCV character-detection pipeline.  
Read before touching `process.py`, `hf_validate.py`, or the process/export API routes.

---

## What It Does

Takes a raw NPM (National Palace Museum) archive JPEG and produces:
- `processed/<safe>/clean.jpg` — colour image after strip/crop preprocessing
- `processed/<safe>/binary.jpg` — adaptive-threshold binarized version
- `processed/<safe>/boxes.json` — detected character bounding boxes + 釋文 alignment

The boxes are loaded by the annotate UI (`/admin/annotate`) as a starting point. The human operator reviews, adjusts, and confirms them.

---

## Pipeline Stages (in order)

```
raw/<safe>.jpg
    │
    ├─ strip_color_bar()        remove NPM Macbeth chart / gradient strip
    ├─ mask_red_ink()           paint red/orange pixels white (removes seal stamps)
    ├─ isolate_text_region()    horizontal crop to scroll paper only
    ├─ binarize()               adaptive Gaussian threshold → black ink / white paper
    │
    ├─ detect_columns()         vertical ink projection → column x-ranges
    │
    └─ for each column:
         detect_chars_in_column()   connected components + recursive split → boxes
         └─ _split_blob_recursive()  split oversized blobs on minimum-ink row
    │
    ├─ _is_plausible_char_box()     filter degenerate boxes
    ├─ sort by (col_idx, y)         right-to-left columns, top-to-bottom within column
    ├─ expand_boxes_horizontally()  capture strokes extending past column boundary
    └─ uniform PAD=4 on all sides   prevent tight boxes from clipping stroke tips
```

---

## Architectural Decisions

### Why pure OpenCV, not PaddleOCR

PaddleOCR was the original detection backend. It was removed because:
1. The model was trained on printed text and performed poorly on cursive / grass script
2. It required a heavy Python dependency (~1GB) with MKL-DNN conflicts on this system
3. For **vertical calligraphy columns**, projection histograms are actually well-suited — the column structure is predictable and the inter-column white space is reliable

### Why adaptive threshold, not Otsu

`cv2.adaptiveThreshold` with `blockSize=31, C=10` handles:
- Uneven illumination across large NPM scans
- Aged/yellowed paper that shifts the global mean
- Ink intensity variation within a single character

A single global Otsu threshold produces noise in bright areas and loses ink in dark areas on these images.

### Why connected components, not contours

`connectedComponentsWithStats` gives area, bounding box, and centroid in one call.  
Contour-based approach requires filtering nested contours and is slower.  
The area filter (`min_area`) cleanly removes single-stroke noise.

### Why sort by column index, not box centre

After horizontal expansion, a box with a long 撇 stroke can have its centre shifted into the adjacent column's x-range. Sorting by the column the box was **detected in** (tagged as `_col` during detection, stripped before JSON output) prevents this from scrambling reading order.

### Why split on the original `inv` image, not the closed image

Morphological closing (`MORPH_CLOSE`) bridges stroke gaps **within** characters. This is exactly what connects the separate strokes of 歸 into one blob. But it also fills the narrow gap **between** 歸 and the next character 人.

`_split_blob_recursive` therefore finds the minimum-ink split row on `inv` (the pre-closing binary) where that gap is still real, not on `closed` where the closing has filled it in.

### Why median-based split threshold, not fixed percentage

`max_char_h = median_h * split_ratio` adapts to the actual character size in each specific scroll. A fixed `0.35 * column_height` was too large for scrolls with many small characters — merged pairs never exceeded the threshold.

### Why no vertical crop

A vertical crop (removing top/bottom border rows) was attempted and then removed entirely. The root cause of failure was `np.convolve` with `mode="same"` pads the array edges with zeros, artificially lowering the smoothed std values for the last ~7 rows near the image edge. This made genuine character-bearing rows look "inactive" regardless of `MIN_EMPTY` threshold — the bottom row of characters was always cut off. The horizontal crop alone is sufficient; empty top/bottom margins do not hurt character detection.

### Why `strip_color_bar` checks only the last 5% (not 15%)

The original 15% check-height caused false positives on scrolls where the bottom row of characters fell within the checked region. Aged paper with dark ink can trigger the HSV saturation threshold. 5% is enough to catch a real calibration strip (which is a narrow band at the very edge) without reaching into the text area.

### Why `mask_red_ink` runs before `binarize` but the color image is saved before masking

Red seal stamps (印章) are painted white before binarization so they disappear from character detection. But `clean.jpg` is saved from the *original* colour image (not the masked one) so the seal is still visible to the human annotator. The masked copy only feeds into `binarize`.

`cv2.inRange` bounds **must** be `np.array([...])`, not plain Python tuples — tuples cause an overload-mismatch error in OpenCV's Python bindings.

### Why density-filter hollow seal frames

Seal stamps often have a square black border outline that survives red masking (the border strokes are black, not red). These appear as large, nearly-hollow bounding boxes in the binary image. The filter `density < 0.06 AND area > min_area * 4` rejects blobs where ink fills less than 6% of the bounding box — real characters are always denser than this.

---

## Tunable Parameters

All exposed as CLI flags and UI sliders (`/admin/annotate`):

| Parameter | Default | What it does |
|-----------|---------|-------------|
| `--close-kernel` | 6 | `MORPH_CLOSE` kernel height. Higher = more stroke fragments joined = more merging risk. Try 3–4 for well-separated characters, 8–10 for broken/faded ink. |
| `--split-ratio` | 1.4 | A blob taller than `split_ratio × median_char_height` gets recursively split. Lower = split more aggressively. 1.4 works for 行書; try 1.6 for 楷書 where characters are more uniform. |
| `--force-split` | off | Bypass CV detection entirely and divide each column into equal-height segments by 釋文 count. Use for 草書 where strokes physically connect across characters. |
| `--debug` | off | Saves `debug.jpg` — side-by-side colour+binary with boxes and 釋文 labels drawn on. Open with `explorer.exe pipeline/data/processed/` from WSL. |
| `--page N` | 0 | Process a specific page instead of the default (page 0). Page 0 reads `raw/<safe>.jpg` and writes to `processed/<safe>/`. Page N > 0 reads `raw/<safe>_pN.jpg` and writes to `processed/<safe>_pN/`. The page image must already be cached locally (view it in the UI first). |

---

## Known Problem Cases

### 行書 with heavy 牽絲 (connecting strokes)

This is the fundamental limitation of OpenCV projection-based segmentation. In 行書 with dense 牽絲, character boundaries have no ink gap — the strokes physically connect across characters. No threshold tuning can reliably find the split point.

Mitigations:
1. **✂ 剪切 (cut) tool** in the annotate UI: click to activate, then click any box to split it exactly in half. Fastest fix for merged pairs.
2. **強制等分**: force-splits the entire column into equal height zones by 釋文 count.
3. **`hf_validate.py`**: experimental HuggingFace Inference API validation (see below).

ML-based segmentation research (CalliReader, ICCV 2025) exists but requires 16GB+ GPU and is not yet packaged for easy use.

### Strokes extending past column boundaries (撇, 捺)

`expand_boxes_horizontally` walks column-by-column outward from the box edge and stops at the first column with insufficient ink density (< 6% of box height). This captures thick diagonal strokes but may miss the tapered tip of a fine 撇. Manual nudge in the UI is the fallback.

Do NOT use lookahead here (allowing N thin columns before stopping). Even a lookahead of 2 bridges narrow inter-column gaps and causes adjacent-column boxes to overlap. The `min_density=0.06` threshold was found empirically — 0.03 is too permissive (noise triggers it), 0.08 is too strict (misses thin strokes).

### 草書 / connected stroke scripts

`detect_chars_in_column` relies on ink gaps between characters. In 草書 these gaps do not exist. Use `--force-split` or the **強制等分** UI button, which divides the column into N equal-height zones (N = 釋文 count ÷ column count). The split points are tuned to horizontal projection minima within each zone.

### NPM border line on scroll edge

Some NPM scans have a solid vertical black line at the very left edge of the scroll paper (a mounting edge). This shows up as a column-wide spike in the vertical projection (projection ≈ image height).

Fix (in `detect_columns`): the threshold is computed excluding any x-positions where projection > 75% of image height. This prevents border spikes from inflating the mean and hiding real text columns next to them.

### Multi-column works where leftmost column is missed

If the leftmost text column has lower-than-average ink projection (sparse script, faded ink), it can fall below the threshold. If this happens, lower the threshold multiplier from `0.6` to `0.4` in `detect_columns`:
```python
threshold = text_proj.mean() * 0.4  # was 0.6
```

### Characters with isolated components (e.g. 點 strokes)

A disconnected 點 that is spatially close to the main character body will be captured if the morphological closing bridges the gap (depends on `close_kernel_h`). If the 點 is too far, it becomes its own tiny blob and gets filtered by `min_area`. The uniform `PAD=4` padding on all boxes helps capture 點 that sit near the box edge.

### Light-border scrolls (rice white mat, not dark mount)

Some NPM pieces (e.g. 故書00000300000 趙孟頫雪晴雲散帖) have a light rice-white border instead of the typical dark teal mount. The std-deviation-based `isolate_text_region` handles this correctly — high std = text columns, low std = uniform border, regardless of whether the border is dark or light. Do not switch back to mean-brightness detection.

### Red seals outside the scroll paper

If `isolate_text_region` is disabled or its crop is too wide, red seal stamps in the border area will be detected. The fix is to ensure the horizontal crop is active and correctly excludes the mat/mount region. `mask_red_ink` handles seals that are ON the paper itself.

### Preview panel misalignment after reprocessing

The annotate UI caches page dimensions in `pageSizes` state. When `clean.jpg` is regenerated with different dimensions (different crop), `pageSizes` must be cleared so hidden probe images re-measure the new file. This is done in `applyBoxData` via `setPageSizes({})` before incrementing `imgVersion`. If you see crops offset in the preview panel, check this reset is happening.

---

## NPM Image Composition

Two common compositions encountered:

**Dark-mount (most common):**
```
┌──────────────────────────────────────────┐
│  dark teal/grey mounting fabric (top)    │
├──────────────────────────────────────────┤
│  ┌──────────────────────────────────┐    │
│  │   bright scroll paper            │    │
│  │   with calligraphy columns       │    │
│  └──────────────────────────────────┘    │
│  dark mounting fabric (bottom/sides)     │
├──────────────────────────────────────────┤
│  Macbeth colour calibration chart        │  ← bottom 5–15%
└──────────────────────────────────────────┘
```

**Light-border (e.g. 故書00000300000):**
```
┌──────────────────────────────────────────┐
│  rice-white mat border (all sides)       │
│  ┌──────────────────────────────────┐    │
│  │   yellowish/brown scroll paper   │    │
│  │   with calligraphy columns       │    │
│  │   red seal stamps on paper       │    │
│  └──────────────────────────────────┘    │
│  rice-white mat border                   │
└──────────────────────────────────────────┘
```

- `strip_color_bar`: checks last 5% of height/width for HSV-saturated calibration strip.
- `isolate_text_region`: std-deviation based horizontal crop. High std = ink contrast = text region. Works for both dark and light borders.
- `mask_red_ink`: HSV range 0–15° and 165–180° with saturation > 80, value > 60. Dilated 5px to catch anti-aliased edges. Uses `np.array` bounds (not tuples) for `cv2.inRange`.

---

## HuggingFace Validation (`hf_validate.py`)

Experimental script that sends character crops to a hosted vision-language model via the free HuggingFace Serverless Inference API and validates each box against the expected 釋文 character.

```
python pipeline/hf_validate.py --id <identifier> [--limit N] [--model <hf-model-id>]
```

Reads `HUGGINGFACE_API_KEY` from `.env.local`. Token must have read access.

Default model: `meta-llama/Llama-3.2-11B-Vision-Instruct`. Fallback: `Qwen/Qwen2.5-VL-7B-Instruct`.

Writes confidence scores back to `boxes.json` (0.9 = YES, 0.5 = UNSURE, 0.2 = NO). The annotate UI renders boxes with `confidence < 0.5` in orange automatically.

**Limitations**: Free tier is rate-limited and model availability varies. 行書 accuracy is ~70% even for good models. Useful as a rough flag, not a reliable classifier.

---

## Process API Route

`POST /api/admin/npm/[identifier]/process`

Body (JSON, all optional):
```json
{
  "forceSplit": false,
  "closeKernel": 6,
  "splitRatio": 1.4,
  "noCrop": false,
  "imageOnly": false,
  "page": 0
}
```

Calls `process.py` via `spawnSync` with 180s timeout. Returns `{ ok: true, boxes: <boxes.json contents> }` on success.

**`page` parameter:** When `page > 0`, the route downloads `raw/<safe>_pN.jpg` if not already cached (from `entry.imagePages[N]`), passes `--page N` to `process.py`, and reads the output from `processed/<safe>_pN/` instead of `processed/<safe>/`. The UI always sends `currentPage` so detection runs on whichever page is being viewed.

The `_req` parameter was renamed to `req` when body parsing was added. If you see a `_req` in the handler, it cannot read the body.

---

## What Gets Stored

For page 0: `boxes.json` is written to `processed/<safe>/boxes.json`.
For page N > 0: written to `processed/<safe>_pN/boxes.json`.

The annotate UI loads page 0's `boxes.json` on initial open (via `GET /api/admin/npm/[identifier]`). Per-page detection results are merged directly into the UI state without re-reading from disk — they are persisted only through the `annotationDraft` in `works_index.json`.

Box coordinates are in **natural image pixels of the source image for that page** (either `clean.jpg` if processed, or the raw image). This matters because `strip_color_bar` and `isolate_text_region` crop the image before `process.py` writes its output — the raw and clean images have different dimensions.

When the operator saves from the annotation UI, coordinates are stored in `annotationDraft` (inside `works_index.json`) in the source image's pixel space, tagged with their `page` number. `export.py` uses `load_page_image(identifier, page_num)` to load the correct image for each page's boxes.

---

## File Paths and Safe Filenames

NPM identifiers contain Chinese characters (e.g. `故書00001800000`). Both Python and TypeScript encode them the same way:

```python
# Python
from urllib.parse import quote
safe = quote(identifier, safe="").replace("%", "_")
# 故書00001800000 → _E6_95_85_E6_9B_B800001800000
```

```typescript
// TypeScript
const safe = encodeURIComponent(identifier).replace(/%/g, "_");
```

Always use `safe_filename(identifier)` when building file paths. Never use the raw identifier as a filename — it breaks on Windows and in Docker.
