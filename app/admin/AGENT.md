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

# 2. Scrape all page image URLs (now runs automatically on first annotate-page load)
python pipeline/fetch_pages.py --id <identifier>

# 3. Run OpenCV detection (or trigger via UI button "偵測字框")
python pipeline/process.py --id <identifier>
```

`process.py` steps: strip colour bar → isolate scroll paper → binarize → detect columns → detect chars per column → expand boxes horizontally → save `boxes.json`. See `pipeline/AGENT.md` for full details.

**Additional `process.py` flags:**
- `--no-crop` — skips `isolate_text_region()`. Use when auto-crop cuts off edge characters.
- `--image-only` — regenerates `clean.jpg`/`binary.jpg` and writes `imageonly.json` (imageSize only), then exits without running detection. Combine with `--no-crop` to undo a bad crop without losing existing box annotations. Output goes to `processed/<safe>/imageonly.json`, never overwrites `boxes.json`.
- `--page N` — process a specific page instead of page 0. Page N reads `raw/<safe>_pN.jpg` and writes to `processed/<safe>_pN/`. The page image must be cached locally first (the UI downloads it on first view). Useful when page 0 is a low-res thumbnail but a later page is the full-resolution scan.

**Auto fetch_pages:** `GET /api/admin/npm/[identifier]` now automatically runs `fetch_pages.py --id <identifier>` (30 s timeout) if `imagePages` is empty, then re-reads the index before responding. No manual step needed for multi-page works.

**Full OpenCV pipeline documentation:** See `pipeline/AGENT.md` for architecture, tuning parameters, known problem cases, and NPM image composition details.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/npm` | List/filter works. Params: `status`, `category`, `q`, `page` |
| PATCH | `/api/admin/npm` | Update work: `identifier`, `status`, `annotationDraft`, `shiwen`, `styleSlug`, `calligrapher` |
| GET | `/api/admin/npm/[id]` | Single work + boxes.json + pageCount. Auto-runs fetch_pages.py if imagePages empty. |
| POST | `/api/admin/npm/[id]/process` | Trigger process.py; returns boxes. Body: `{ forceSplit?, closeKernel?, splitRatio?, noCrop?, imageOnly?, page? }` |
| GET | `/api/admin/npm-image/[id]` | Serve image. Params: `type` (`clean`/`binary`/`raw`), `page` |

**POST /process response shape:**
- Normal: `{ ok: true, boxes: BoxesData }`
- `imageOnly: true`: `{ ok: true, imageOnly: true, imageSize: { w, h } }` — boxes.json is NOT touched; read `imageonly.json` instead.

All admin routes read/write `pipeline/data/works_index.json` directly via `fs` (no database). This file is the sole persistence layer for the annotation system.

---

## Annotate Canvas — Key Behaviors

- **Draw mode**: toggled by "繪製新框" button; cursor becomes crosshair; mousedown/mouseup on canvas draws a new box
- **Cut mode**: toggled by "✂ 剪切" button (mutually exclusive with draw mode); clicking any box splits it into two equal halves (top + bottom). Both halves inherit the original box's `source`, `confidence`, `char`, and `page`. Uses `crypto.randomUUID()` for new IDs.
- **Select**: click a box to select it (sets `selectedIds`); shift+click toggles multi-select
- **Drag**: mousedown on a box (non-shift, non-draw-mode, non-cut-mode) starts drag via global mousemove/mouseup listeners
- **Resize**: 8 handles rendered only when exactly one box is selected; uses `resizingRef` (not state) to avoid re-render churn. Disabled in cut mode.
- **Delete**: Delete/Backspace key removes all selected boxes (no-op when an input/textarea is focused)
- **Deselect**: clicking the canvas background (not a box, not in draw mode) clears selection
- **Auto-save**: `saveDraft` runs every 30 seconds while status is not "done"
- **Zoom**: Ctrl+wheel zooms; +/−/↺ buttons in header; coordinate math uses `scale = (clientWidth / imageSize.w) * zoom`
- **Export shortcut**: 匯出 button next to 確認完成; only enabled when `work.status === "done"`. Calls `/api/admin/export` then `/api/admin/export/upload` sequentially without leaving the page.
- **Undo/Redo (↩ ↪)**: Always visible in the top navbar. Up to 10 snapshots of `{ boxes, shiwenChars, shiwenInput, imageSize }`. `pushHistory()` is called before every destructive operation (偵測字框, 還原裁切, 清空框選); redo stack is cleared on any new action. State lives in `history` / `future` arrays; refs (`boxesRef`, `shiwenCharsRef`, `imageSizeRef`, `shiwenInputRef`) are used to read current values at push time without stale closures.
- **還原裁切**: Sidebar button. Calls process route with `{ noCrop: true, imageOnly: true, page: currentPage }`. Regenerates `clean.jpg` for the current page without auto-crop, clears only the current page's boxes (coordinates would be relative to the old cropped image), updates `pageSizes[currentPage]`. Does NOT overwrite `boxes.json`. Use when `isolate_text_region()` clips edge characters; then press 偵測字框 to re-detect on the full image.
- **偵測字框**: Calls process route with `{ page: currentPage, ... }`. Runs detection on whichever page is currently viewed. Returns boxes for that page only — merges them into the current page, leaving other pages' boxes untouched. Character assignment is re-run globally across all pages after the merge.

**Coordinate system:** Box `x/y/w/h` are in **natural image pixels** (not scaled pixels). All mouse coordinate math divides by `zoom * renderScale` to convert back to natural pixels before storing.

**`renderScale` and `pageSizes`:** `renderScale = clientWidth / naturalWidth` is set in `handleImageLoad` (fires on `onLoad`). `pageSizes` maps page index → `{w, h}` and drives the preview panel crop calculations. **Both must be invalidated when `clean.jpg` is regenerated** — `applyBoxData` calls `setPageSizes({})` before incrementing `imgVersion` so hidden probe images re-measure the new dimensions. If preview crops are misaligned after reprocessing, this reset is the first thing to check.

**Image cache-control:** The `npm-image` API route serves `processed/` files with `Cache-Control: no-store` and `raw/` files with `private, max-age=3600`. This prevents stale `clean.jpg` from being served after reprocessing. The `?v=${imgVersion}` query param on the main canvas image forces a fresh fetch even if the browser has a cached response.

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
- **`imagePages[]` is now auto-scraped** by `GET /api/admin/npm/[id]` if empty. Manual `fetch_pages.py --id` is no longer needed on first open, but the script still works for bulk backfills.
- **process.py requires `.venv`**: The Next.js process route calls `.venv/bin/python3`. The virtualenv must exist at project root with `opencv-python` installed. PaddleOCR has been removed — do not re-add it.
- **`--image-only` does not touch `boxes.json`**: it writes `imageonly.json` instead. The route reads `imageonly.json` and returns `{ imageOnly: true, imageSize }`. Do not confuse with a normal process run.
- **還原裁切 clears boxes**: because existing box coordinates are relative to the cropped `clean.jpg`. After undoing the crop, re-run 偵測字框 on the new full image. Use ↩ to revert if the result is worse.
- **Cut mode and draw mode are mutually exclusive**: activating one deactivates the other. Both disable box drag and resize.
- **`canFinish` guard**: `確認完成` requires `countMatch && styleInput.trim().length > 0 && boxes.length > 0`. The `boxes.length > 0` check is critical — without it, `0 === 0` (zero boxes matching zero 釋文 chars) would incorrectly enable the button.
- **Export page `uploadedAt` indicator**: after a successful upload via `/api/admin/export/upload`, the route stamps `uploadedAt` onto the `works_index.json` entry. The export page shows a green ✓ 已上傳 pill for works where this field is set.
- **Re-export after re-annotation**: when `PATCH /api/admin/npm` sets `status: "done"` on a work that already has `uploaded: true`, the handler resets `uploaded: false`. This makes `export.py` pick it up again without needing `--force`. Without this, re-completing an already-exported work silently skips the export step.
- **R2 cache TTL**: `upload_work.py` sets `Cache-Control: public, max-age=3600` on uploaded WebP files. After overwriting an image on R2, clients holding a cached copy will see the old version for up to 1 hour. To see updated crops immediately, open the page in a private/incognito tab.
