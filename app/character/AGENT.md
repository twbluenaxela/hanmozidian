# Character Page & ZitieModal — Architecture Notes

> Context for AI agents and developers working on `app/character/[char]/page.tsx` and `components/ZitieModal.tsx`. Read this before touching either file.

---

## What This Page Does

`/character/[char]` is the main dictionary lookup page. It shows all available calligraphy images for a single character, grouped by script style (楷、行、草、隸、篆、金文). Users can:

- Filter by script style (tab bar)
- Filter by calligrapher / work (JiziPicker sidebar)
- Open an image in a lightbox (ImageModal)
- Launch the 字帖 generator (ZitieModal)
- Favourite images (FavoriteButton)

---

## ZitieModal — What It Does

`components/ZitieModal.tsx` is a full-screen overlay (z-60) that lets users generate a calligraphy practice sheet (字帖) from a chosen character image. It renders a live grid preview and exports to PNG or PDF via `html-to-image` + `jsPDF`.

### Controls

The controls panel has three tabs — **版面**, **格線**, **樣式** — accessible via a collapsible sidebar on desktop and a bottom sheet on mobile.

| Tab | Settings |
|-----|----------|
| 版面 | Columns (2–8), rows (2–8), reference mode (首欄/首格/隔格/純空格), 描紅 opacity |
| 格線 | Grid type: 米字格 / 九宮格 / 無格 |
| 樣式 | Image selector, paper colour, 一鍵去底 toggle |

### One-click Background Removal (一鍵去底)

- **On by default** (`useState(true)`)
- Uses an inline SVG `<filter id="zitie-ink">` that converts the image to ink-only (transparent background): desaturates → inverts luminance to alpha → thresholds with `feFuncA slope=4 intercept=-2.8`
- When off, uses `grayscale(1) contrast(200%) brightness(110%)` CSS filter instead
- **Known limitation**: dark-background images (e.g. deep yellow, red rubbings) produce poor results with 去底 on because the filter treats all non-white pixels as ink. The hint text under the button warns the user: "深色底圖（如深黃、紅底）效果可能較差，可關閉"

### Tab Active-Option Indicator

When `removeBg` is `true` and the user is viewing a tab other than 樣式, a small accent-coloured dot appears near the 樣式 tab label. This communicates "there's an active setting in this tab" without requiring the user to open it.

Implementation: `tabActiveOptions` map (`Record<SideTab, boolean>`) drives the dot. Currently only `樣式` ever has an active option (when `removeBg` is on). To add indicators for other tabs in future, extend this map.

### Grid Rendering Order

The `<GridOverlay>` SVG is rendered **after** the character `<img>` in the DOM, so it always sits on top of the image in normal stacking order. Do not move it before the image — the grid lines would be covered.

### Reference Cells vs Practice Cells

`isReference(idx, cols, mode)` determines which cells show the character at full opacity (reference/示範) vs at `guideOpacity`% opacity (tracing/描紅). The four modes:

| Mode | Behaviour |
|------|-----------|
| `first-col` | First cell in every row is a reference |
| `first-cell` | Only cell 0 is a reference |
| `alternating` | Every even-indexed cell is a reference |
| `empty` | No images shown at all (blank practice sheet) |

### Export

Both PNG and PDF export use `html-to-image`'s `toPng` at 3× pixel ratio with `backgroundColor: paper.color` set explicitly (the SVG filter leaves pixels transparent — the paper colour must be composited by `html-to-image`, not by the browser). The PDF preserves the exact pixel dimensions of the PNG.

---

## Known Issues / Gotchas

- **CORS**: Images must load with `crossOrigin="anonymous"` for `html-to-image` to read them. The `useImageRetry` hook appends `cors=1` to keep CORS and non-CORS cache entries separate. Do not remove this param.
- **SVG filter scope**: `<filter id="zitie-ink">` is defined once in a hidden `<svg>` outside the grid. All cells reference it via `url(#zitie-ink)`. ID collisions would break the filter if ZitieModal is ever rendered more than once simultaneously (currently impossible — it's a full-screen singleton).
- **Dark backgrounds**: See 一鍵去底 note above. The filter is not aware of background colour; it only knows pixel luminance.
