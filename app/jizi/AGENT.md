# 集字工坊 (Jizi) — Architecture Notes

> Context for AI agents and developers working on `app/jizi/page.tsx` and related files. Read this before touching anything in the jizi subsystem.

---

## What This Page Does

The jizi page lets users type a Chinese phrase, pick a calligraphy style (and optional calligrapher/work filter), and compose a visual board where each character is shown as a historical calligraphy image. They can then adjust per-character styling (grid overlays, borders, invert, scale, rotation) and export or copy the result as a PNG.

---

## File Map

| File | Role |
|------|------|
| `app/jizi/page.tsx` | The entire page (~615 lines). All state lives here. |
| `app/api/jizi/route.ts` | `GET /api/jizi?text=&style=&calligrapher=&work=` — returns per-character image arrays |
| `app/api/jizi/coverage/route.ts` | `GET /api/jizi/coverage?text=&style=` — returns which calligraphers/works have coverage for the current text, used to populate the filter picker |
| `components/JiziPicker.tsx` | Filter sidebar: lets users pick a calligrapher or work to restrict images to |
| `components/CalligraphyCharacter.tsx` | Single character tile — image with optional CSS/SVG filters, grid overlays, borders |
| `lib/useImageRetry.ts` | Image loading hook with auto-retry and session-scoped URL cache |
| `lib/savedJizi.ts` | Firestore save/load for named compositions |
| `lib/utils.ts` → `resolveCurrentImage` | Given an image array and an optional selected ID, returns the image to display |

---

## State Architecture

All state is in `JiziPage`. There is no external state manager.

```
text                     string           — raw textarea content
selectedStyle            string           — script style slug ("kai", "li", etc.)
results                  any[]            — API response: one entry per character in text
composition              Record<number, CompositionItem>  — per-character overrides, keyed by index
activeIndices            number[]         — which character cells are currently selected
selectedCalligraphers    number[]         — active calligrapher filter IDs
selectedWorks            number[]         — active work filter IDs
paper / orientation / gridSize / gap     — layout/appearance globals
```

### Why `composition` is keyed by index, not character

Multiple occurrences of the same character in the text (e.g. 巍巍) need independent settings. Keying by array index is simpler and correct. The downside is that if the user edits the middle of the text, indices shift and composition settings become misaligned — this is accepted as a known limitation. The typical use case is composing a fixed phrase, not editing it heavily.

### `DEFAULT_SETTINGS` fallback

`composition[idx]` is only written when the user explicitly changes a setting. `getSetting(key)` falls back to `DEFAULT_SETTINGS` when the index has no entry, so newly added characters always start with clean defaults without any initialization step.

---

## Data Flow: Text → Canvas

```
textarea onChange
    → debounce 400ms (useEffect dep: [text, selectedStyle, selectedCalligraphers, selectedWorks])
    → handleCompose()
    → GET /api/jizi?text=...&style=...&calligrapher=...&work=...
    → setResults(data.characters)
    → canvas re-renders

For each character in results:
    s = composition[idx] || DEFAULT_SETTINGS
    currentImg = resolveCurrentImage(res.images, s.selectedImageId)
    → <CalligraphyCharacter imageUrl={currentImg.imageUrl} {...s} />
```

The API returns up to 100 images per character (deterministic order: `ORDER BY calligraphyImages.id`). The canvas always shows `images[0]` unless the user has picked an alternative (`s.selectedImageId`).

### IME handling

`isComposing` ref is set during `onCompositionStart` / `onCompositionEnd`. The debounce timer only fires `handleCompose` when `isComposing.current === false`, preventing mid-composition API calls when users type with an input method editor.

---

## Canvas Rendering

The canvas is a plain `div` with `display: inline-flex; flex-wrap: wrap` (horizontal) or `writing-mode: vertical-rl` (vertical). It uses `ref={canvasRef}` so `html-to-image` can snapshot it for export/copy.

### React key design — important

Character cells use `key={\`${idx}-${res.character}\`}`.

**Do not change this to include the image ID.** The previous key was `${idx}-${currentImg?.id || "empty"}`, which caused mass remounts whenever a work/calligrapher filter was applied (image IDs change → all keys change → all components unmount/remount → ~30 concurrent R2 image requests → Cloudflare rate limiting → images stuck in skeleton for ~1 minute).

Using the character as part of the key means:
- Same character at same position → component stays mounted across filter changes
- `imageUrl` prop update → `useImageRetry` detects URL change and re-loads
- Character actually changes at a position → component remounts (correct)

---

## Image Loading: `useImageRetry`

Lives in `lib/useImageRetry.ts`. Key behaviors:

1. **Auto-retry**: On first `onError`, waits 500ms then retries with a `&r=1` cache-buster. Marks as `"failed"` after one retry.
2. **Session cache**: A module-level `Set<string>` remembers every URL that has successfully loaded this session. If the same URL is requested again (e.g. after a filter change that doesn't actually change the displayed image, or after a component re-render), status is immediately `"loaded"` — no skeleton, no HTTP request.
3. **`cors=1` / `gallery=1` query params**: Added to keep CORS and non-CORS cache entries separate in the browser and on Cloudflare. Do not remove these — the jizi canvas uses `crossOrigin="anonymous"` for `html-to-image` export.

The session cache is keyed on `imageUrl?queryParam` (the base URL before any retry token). It is never cleared within a session; this is intentional since calligraphy images are immutable.

---

## Cloudflare / R2 Rate Limiting

This has been a recurring issue. Symptoms: characters show skeleton animation for ~60 seconds, then load. Root cause: too many concurrent R2 image requests in a short window (triggered by filter changes causing component remounts with new image URLs).

Mitigations already in place:
- Stable React keys (see above) — prevents mass remounts on filter change
- Session URL cache in `useImageRetry` — prevents re-fetching already-loaded images

If the issue recurs, check whether the R2 public URL is an `r2.dev` URL (no CDN caching) vs a custom domain with Cloudflare proxy (CDN cached). `r2.dev` URLs are served directly from R2 origin on every request, even with `Cache-Control: public, max-age=86400`. A custom domain with Cloudflare proxy enabled caches at the edge after the first request.

---

## JiziPicker (Filter Sidebar)

`components/JiziPicker.tsx` fetches `/api/jizi/coverage?text=&style=` whenever `text` or `style` changes (while `open=true`). Coverage returns the list of calligraphers/works that have at least one image for at least one character in the current text, along with image counts. Calligraphers/works with `imageCount === 0` are shown as disabled chips.

The picker is always mounted (rendered inside a `hidden`/visible CSS toggle, not conditionally) to avoid re-fetching coverage every time the user opens it.

Selecting a work or calligrapher sets `selectedWorks` / `selectedCalligraphers` in the parent, which feeds into the next `handleCompose` call.

---

## Per-Character Settings (`CompositionItem`)

```typescript
type CompositionItem = {
  selectedImageId?: number;   // user-picked alternative image
  grid: "none" | "jiu" | "mi";
  invert: boolean;            // white-on-black (rubbing style)
  wireframe: boolean;         // edge-detection outline
  removeBg: boolean;          // ink-only, transparent background
  showBorder: boolean;
  borderShape: "square" | "circle";
  borderWidth: number;
  borderColor: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
};
```

`updateActiveCharsSetting(key, val)` applies a setting change to all currently selected characters at once. Multi-select works via Shift+click (range) or Ctrl/Cmd+click (toggle).

---

## Export / Copy

Both export (`匯出作品`) and copy (`分享`) use `html-to-image`'s `toPng`:
- Pixel ratio 3× for export, 3× for copy
- `crossOrigin="anonymous"` is set on all `<img>` elements inside `CalligraphyCharacter` so `html-to-image` can read cross-origin R2 images without tainting the canvas
- Active selection ring and open sidebars are hidden before capturing (300ms delay to let CSS transitions complete)
- The copy button writes to `navigator.clipboard.write` — does **not** use `navigator.share`, which opens a native OS share dialog that has no clipboard option on Windows

---

## Saved Compositions

`lib/savedJizi.ts` persists compositions to Firestore under `users/{uid}/savedJizi/{id}`. The full `composition` record (all `CompositionItem` overrides), text, style, filters, layout settings, and a 1× thumbnail PNG are stored.

`JIZI_LOAD_KEY` is a `sessionStorage` key. The "My Collection" page writes a serialised composition to `sessionStorage` and navigates to `/jizi`; on mount, the jizi page reads and restores it, then clears the key.

---

## Known Limitations / Gotchas

- **Composition index drift**: Editing the middle of the text shifts indices, misaligning saved `composition` overrides. Acceptable for the typical "compose a fixed phrase" use case.
- **`found: true` with empty images**: The API sets `found: true` whenever the character exists in the DB, regardless of whether the current filter has any images for it. A character can be `found: true` with `images: []`, which renders as the dashed fallback box. This is intentional — it distinguishes "character exists but not in this work" from "character not in our dataset at all."
- **Punctuation**: Characters like 。 are not in the DB, so they always render as dashed fallbacks. This is fine; users typically want to include punctuation in their composition for layout purposes.
- **`html-to-image` and SVG filters**: The `CalligraphyCharacter` component defines SVG `<filter>` elements inline. `html-to-image` handles these correctly as long as the images have loaded (status = "loaded") before export is triggered. The 300ms pre-export delay exists for this reason.
