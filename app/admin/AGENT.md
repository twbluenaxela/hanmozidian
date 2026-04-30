# Admin Annotation System — Agent Context

This document covers the architecture, data flow, and key decisions for the admin annotation subsystem. Read before modifying any file under `app/admin/`, `app/api/admin/`, or `pipeline/`.

---

## What This System Does

A human-in-the-loop pipeline for turning scanned NPM (National Palace Museum) calligraphy images into character-level training data. The operator:

1. Runs Python pipeline scripts to ingest and pre-process works
2. Opens the admin UI at `/admin` to review a queue of works
3. Opens `/admin/annotate?id=<identifier>` to draw bounding boxes over characters and align them to the 釋文 (transcription text)
4. Saves the draft; marks work as done when box count matches character count

The end product is a `annotationDraft` JSON blob stored in `works_index.json`, containing boxes + shiwenChars per work — later consumed to populate the calligraphy database.

---

## File Map

```
app/
  admin/
    page.tsx                    — Queue dashboard (list + filter + status)
    annotate/page.tsx           — Annotation canvas (main complex component)
    AGENT.md                    — This file

app/api/admin/
  npm/route.ts                  — GET (list/filter works) + PATCH (save draft/status)
  npm/[identifier]/route.ts     — GET (single work + boxes + pageCount)
  npm/[identifier]/process/route.ts  — POST (triggers process.py via spawnSync)
  npm-image/[identifier]/route.ts    — GET image (local cache → NPM proxy fallback)

pipeline/
  ingest.py                     — Fetch NPM API metadata → works_index.json
  fetch_pages.py                — Scrape NPM detail pages → imagePages[] per work
  process.py                    — OpenCV column/char detection → boxes.json
  data/
    works_index.json            — Single source of truth for all work metadata
    raw/<safe>.jpg              — Downloaded original images
    raw/<safe>_p<N>.jpg         — Multi-page raw images (cached from NPM)
    processed/<safe>/
      clean.jpg                 — Color-cropped + bar-stripped image
      binary.jpg                — Adaptive-threshold binarized image
      boxes.json                — OCR detection output (projection + PaddleOCR)
    processed/<safe>_p<N>/      — Per-page processed output (multi-page works)

__tests__/admin/
  annotate-multipage.test.tsx   — Jest tests for annotation canvas behavior
```

---

## Data Model: `works_index.json`

Every work is keyed by its NPM 文物統一編號 (identifier). Shape of each entry:

```json
{
  "identifier": "中書00000100000",
  "name": "草書千字文",
  "category": "法書",
  "calligrapher": "懷素",
  "era": "唐",
  "styleSlug": "cao",
  "shiwen": "天地玄黃宇宙洪荒...",
  "imageUrl": "https://digitalarchive.npm.gov.tw/Image/GetImage?imageId=...",
  "imagePages": [
    "https://digitalarchive.npm.gov.tw/Image/GetImage?imageId=459541&randomCode=12345",
    "https://digitalarchive.npm.gov.tw/Image/GetImage?imageId=459542&randomCode=67890",
    "..."
  ],
  "sourceUrl": "https://digitalarchive.npm.gov.tw/Collection/Detail/13889",
  "status": "annotating",
  "annotationDraft": "{\"boxes\":[...],\"shiwenChars\":[...],\"imageSize\":{...}}",
  "updatedAt": "2026-04-25T10:00:00"
}
```

Key points:
- `imagePages[]` is populated by `fetch_pages.py` — scrapes the NPM detail page HTML. The NPM open-data API only returns `imageUrl_m` for the first image; all pages require HTML scraping.
- `annotationDraft` is a **JSON string** (double-encoded) stored inside the JSON. Parse it with `JSON.parse(entry.annotationDraft)`.
- `status` lifecycle: `pending` → `processing` (after process.py runs) → `annotating` (while editing) → `done` / `skipped`
- `styleSlug` maps to the canonical style keys used by the main DB: `jinwen`, `kai`, `xing`, `cao`, `li`, `zhuan`

---

## Draft Format (annotationDraft)

```typescript
interface Draft {
  boxes: Box[];          // all boxes across all pages
  shiwenChars: string[]; // filtered transcription characters (punctuation removed)
  imageSize: { w: number; h: number };  // image dimensions in natural pixels
}

interface Box {
  id: string;           // e.g. "box-1714000000000-1"
  x: number;            // left edge in natural image pixels
  y: number;            // top edge in natural image pixels
  w: number;
  h: number;
  confidence: number;   // 0–1; manual boxes get 1.0
  source: "projection" | "paddle" | "manual";
  char: string;         // assigned character (may be "" or "□" for unknown)
  page: number;         // 0-indexed page within this work
}
```

**Migration:** Old single-page drafts have no `page` field on boxes. The annotate page migrates them with `b.page ?? 0` on load.

---

## Character Assignment Logic

This is the most subtle part of the system.

**Rule: boxes are assigned characters in draw order, not spatial order.**

`sortedGlobalOrder(boxes)` sorts by `page` only — within a page, array order (draw order) is preserved. This is intentional: re-sorting by `(page, y, x)` was a bug that caused newly drawn boxes to steal character assignments from existing boxes.

```typescript
function sortedGlobalOrder(boxes: Box[]): Box[] {
  return [...boxes].sort((a, b) => a.page - b.page);
}
```

Character assignment happens in two places:
1. `applyShiwen(chars)` — when 釋文 text changes
2. After any box is added or deleted — the whole array is re-mapped

The global index (1-based label shown on each box) is derived from this same ordering.

**Punctuation filtering:** `shiwenChars` strips `。，、；：「」□` and whitespace from the raw 釋文 input. The `□` (U+25A1) character is used as a deliberate placeholder for illegible characters.

---

## Multi-Page Architecture

Works can have up to ~20+ pages. The operator navigates pages; each page is a separate image.

**Image serving** (`npm-image/[identifier]/route.ts`):
- `?page=0` (or absent) → `processed/<safe>/clean.jpg` → `raw/<safe>.jpg` → proxy `imagePages[0]` or `imageUrl`
- `?page=N` (N > 0) → `processed/<safe>_pN/clean.jpg` → `raw/<safe>_pN.jpg` → proxy `imagePages[N]`
- Downloaded images are cached locally in `raw/` on first proxy hit

**Page count** is returned by `GET /api/admin/npm/[identifier]` as `pageCount = entry.imagePages?.length ?? 1`.

**Frontend state:** `currentPage` (0-indexed) controls which image is shown and which boxes are rendered. Boxes from other pages are hidden but preserved in state. The image element has a `key` prop (`${identifier}-p${currentPage}`) so React remounts it on page change, triggering `onLoad` to recalculate `renderScale`.

---

## Image Processing Pipeline

Run in order for a new work:

```bash
# 1. Ingest metadata from NPM API
python pipeline/ingest.py --id <identifier>

# 2. Scrape all page image URLs
python pipeline/fetch_pages.py --id <identifier>

# 3. Run OpenCV detection (or trigger via UI button "偵測字框")
python pipeline/process.py --id <identifier>
```

`process.py` steps:
1. `strip_color_bar` — removes NPM color calibration strip at bottom (detects by saturation + tonal gradient, walks entire check region to find topmost bar row)
2. `isolate_text_region` — crops out title/colophon panels by column brightness
3. `binarize` — adaptive Gaussian threshold
4. `detect_columns` — vertical projection, right-to-left column order
5. `detect_chars_in_column` — horizontal projection within each column
6. `detect_with_paddle` — PaddleOCR (optional; used if installed, else falls back to projection)
7. Saves `boxes.json` with merged results

**Known issue (strip_color_bar):** The check region is 15% of image height. If a color bar is taller than 15% of the image, it won't be fully detected. Adjust `check_height` if needed.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/npm` | List/filter works. Params: `status`, `category`, `q`, `page` |
| PATCH | `/api/admin/npm` | Update work: `identifier`, `status`, `annotationDraft`, `shiwen`, `styleSlug`, `calligrapher` |
| GET | `/api/admin/npm/[id]` | Single work + boxes.json + pageCount |
| POST | `/api/admin/npm/[id]/process` | Trigger process.py; returns boxes |
| GET | `/api/admin/npm-image/[id]` | Serve image. Params: `type` (`clean`/`binary`/`raw`), `page` |

All admin routes read/write `pipeline/data/works_index.json` directly via `fs` (no database). This file is the sole persistence layer for the annotation system.

---

## Annotate Canvas — Key Behaviors

- **Draw mode**: toggled by "繪製新框" button; cursor becomes crosshair; mousedown/mouseup on canvas draws a new box
- **Select**: click a box to select it (sets `selectedIds`); shift+click toggles multi-select
- **Drag**: mousedown on a box (non-shift, non-draw-mode) starts drag via global mousemove/mouseup listeners
- **Resize**: 8 handles rendered only when exactly one box is selected; uses `resizingRef` (not state) to avoid re-render churn
- **Delete**: Delete/Backspace key removes all selected boxes (no-op when an input/textarea is focused)
- **Deselect**: clicking the canvas background (not a box, not in draw mode) clears selection
- **Auto-save**: `saveDraft` runs every 30 seconds while status is not "done"
- **Zoom**: Ctrl+wheel zooms; +/−/↺ buttons in header; coordinate math uses `scale = (clientWidth / imageSize.w) * zoom`

**Coordinate system:** Box `x/y/w/h` are in **natural image pixels** (not scaled pixels). All mouse coordinate math divides by `zoom * renderScale` to convert back to natural pixels before storing.

---

## Testing

```bash
npx jest "annotate-multipage"
```

`__tests__/admin/annotate-multipage.test.tsx` covers:
- Draw-order preservation (Prove-It: new box at smaller y must not steal earlier character)
- Multi-page navigation (show/hide, prev/next, boundary disabled states)
- Draft migration (old boxes without `page` field default to page 0)
- Delete key (Delete, Backspace, no-op when input focused, no-op with no selection)
- Canvas background click deselects (not in draw mode)

When adding features to the annotate page, add tests here first (Prove-It pattern for bug fixes).

---

## Common Pitfalls

- **`safeFilename`**: identifiers contain Chinese characters; both Python (`urllib.parse.quote`) and TypeScript (`encodeURIComponent`) encode them, replacing `%` with `_`. Always use `safeFilename(identifier)` when constructing file paths.
- **Double-encoded draft**: `entry.annotationDraft` is a JSON string stored inside the JSON index. It must be `JSON.stringify`'d before saving and `JSON.parse`'d after loading.
- **Page index is 0-based internally**, but displayed as 1-based in the UI ("頁 1 / 12" = `currentPage === 0`).
- **`imagePages[]` must be scraped separately** via `fetch_pages.py`. The NPM open-data API does not return them. Without this step, multi-page navigation will proxy the same first image for all pages.
- **process.py requires `.venv`**: The Next.js process route calls `.venv/bin/python3`. The virtualenv must exist at project root with `opencv-python`, `paddlepaddle`, and `paddleocr` installed (see `pipeline/requirements.txt`).
