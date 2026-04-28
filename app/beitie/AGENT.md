# 碑帖 (Beitie) Subsystem — Agent Architecture Notes

> Read this before touching any file under `app/beitie/`, `app/admin/beitie/`, `app/api/beitie/`, `app/api/admin/beitie/`, or `lib/db/beitie-queries.ts`.

## Overview

The beitie subsystem is a curated gallery of historical calligraphy works (steles, rubbings, manuscript facsimiles). Each work has rich metadata, multi-page image scans, full-text transcription (釋文), and AI-generated scholarly commentary.

It is architecturally **separate from the main calligraphy dictionary** in every layer:
- Different database (Cloudflare D1, not the local SQLite)
- Different image prefix on R2 (`beitie/` vs `images/`)
- Different query layer (`lib/db/beitie-queries.ts` vs `lib/db/queries.ts`)
- Different AI provider for content generation (Gemini, not Claude)

---

## Data Storage

### Database: Cloudflare D1 (not SQLite)

All beitie data lives exclusively in **Cloudflare D1**, Anthropic's serverless SQL database. There is **no local SQLite table** for beitie. All reads and writes go through the D1 REST API via `lib/db/d1-client.ts`.

Because `d1Query()` is an HTTP call, all beitie query functions are **`async`**. Do not call them without `await`. This is the opposite of the main app's `better-sqlite3` queries which are synchronous.

Required env vars — without these, every beitie query throws:
```
CF_ACCOUNT_ID=
CF_API_TOKEN=
D1_DATABASE_ID=
```

### D1 Table: `beitie`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | auto-increment |
| `title` | TEXT | work title |
| `author` | TEXT | calligrapher name |
| `dynasty` | TEXT | e.g. 東晉、唐 |
| `style` | TEXT | display name e.g. 楷書 |
| `style_slug` | TEXT | one of: `kai`, `xing`, `cao`, `li`, `zhuan` |
| `year_label` | TEXT | optional e.g. 353年 |
| `medium` | TEXT | optional e.g. 紙本墨跡 |
| `char_count` | INTEGER | optional |
| `summary` | TEXT | one-line description |
| `tags` | TEXT | **JSON array**, e.g. `["天下第一行書"]` |
| `cover_image` | TEXT | R2 public URL |
| `pages_json` | TEXT | **JSON array** of R2 URLs (subsequent pages) |
| `shiwen` | TEXT | full-text transcription |
| `source_credit` | TEXT | e.g. 國立故宮博物院 |
| `source_url` | TEXT | link to source |
| `ai_history` | TEXT | AI-generated historical background |
| `ai_biography` | TEXT | AI-generated author biography |
| `ai_style` | TEXT | AI-generated style analysis |
| `ai_influence` | TEXT | AI-generated influence section |
| `ai_stories` | TEXT | AI-generated anecdotes |
| `ai_practice` | TEXT | AI-generated practice advice |
| `ai_generated_at` | TEXT | ISO timestamp or `datetime('now')` |
| `updated_at` | TEXT | set via `datetime('now')` in SQL |

**Critical**: `tags` and `pages_json` are stored as JSON strings. `beitie-queries.ts` handles serialization — always use the query functions, never raw SQL from outside the query layer.

### Images: Cloudflare R2

Images are uploaded directly to R2 under the `beitie/` prefix:
```
beitie/{timestamp}-{sanitized-filename}.{ext}
```
Public URL: `${R2_PUBLIC_URL}/beitie/{filename}`

Upload endpoint: `POST /api/admin/beitie/upload` (multipart form, field name `files`).

---

## Query Layer

**File**: `lib/db/beitie-queries.ts`

All database interaction goes through these exported functions:

| Function | Description |
|----------|-------------|
| `listBeitie(styleSlug?)` | List all works, optionally filtered by style slug |
| `getBeitieById(id)` | Fetch single work by ID |
| `insertBeitie(data)` | Create new work, returns new `id` |
| `updateBeitie(id, fields)` | Partial update — only provided fields are written |
| `deleteBeitie(id)` | Delete by ID |
| `saveAiSummary(id, sections)` | Write all 6 AI sections + set `ai_generated_at` |

`updateBeitie` uses a dynamic `SET` clause — it only modifies the fields you pass. `tags` and `pages` keys are handled specially (JSON-serialized before writing).

---

## API Routes

### Public (no auth)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/beitie` | GET | List works; `?style=kai` filters by slug |
| `/api/beitie/[id]` | GET | Fetch single work |
| `/api/beitie/[id]` | POST | **Legacy** Claude-based AI generation (not used by UI) |

### Admin

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/beitie` | GET | List all works (admin view) |
| `/api/admin/beitie` | POST | Create new work |
| `/api/admin/beitie/[id]` | PATCH | Update fields |
| `/api/admin/beitie/[id]` | DELETE | Delete work |
| `/api/admin/beitie/[id]/generate-ai` | POST | Generate AI sections via Gemini |
| `/api/admin/beitie/[id]/generate-ai` | GET | List available Gemini models (live from API) |
| `/api/admin/beitie/[id]/upload-d1` | POST | Force-upsert current D1 record (idempotent) |
| `/api/admin/beitie/upload` | POST | Upload image files to R2 |
| `/api/admin/beitie/npm-lookup` | GET | Search NPM works index |
| `/api/admin/beitie/npm-fetch-pages` | POST | Scrape NPM detail page + IIIF manifest, write back to works_index.json |

---

## AI Generation

### Provider: Google Gemini (primary)

Route: `POST /api/admin/beitie/[id]/generate-ai`  
SDK: `@google/generative-ai`  
Env var: `GEMINI_API_KEY`

The prompt instructs the model to return **strict JSON** with 6 keys. The route strips markdown code fences from the response before `JSON.parse`. If parse fails, it returns a 502 with `error: "parse_error"`.

Rate limit handling:
- `429` with "perday" / "per day" / "limit: 0" → `error: "daily_quota_exhausted"` (no retry timer)
- `429` otherwise → `error: "rate_limited"` with `retrySeconds` extracted from error message
- UI shows a countdown and re-enables the button when it reaches 0

Available models are fetched live from the Gemini API on page load (`GET generate-ai`). The hardcoded fallback list in the UI is only used if that request fails.

### Legacy: Anthropic Claude

Route: `POST /api/beitie/[id]` (public route)  
SDK: `@anthropic-ai/sdk`  
Model: `claude-opus-4-5`

This generates 6 sections with sequential API calls (one per section). It is **not triggered by the current admin UI** — the edit page uses Gemini. Kept for backward compatibility. If you need to update the AI generation model here, update the model ID at `app/api/beitie/[id]/route.ts:49`.

---

## NPM (National Palace Museum) Integration

The add-beitie form has an NPM lookup tab. It searches `pipeline/data/works_index.json` (a flat file on disk) via `/api/admin/beitie/npm-lookup`.

The `works_index.json` stores entries with:
- `imagePages`: array of page image URLs (populated on demand — see below)
- `iiifPages`: IIIF tile URLs (full-res fallback)
- `imageUrl`: single medium-quality image from the NPM Open Data API

### Automatic multi-page fetch

When the user selects a work in the add form whose `imagePages` is empty, the UI **automatically** calls `POST /api/admin/beitie/npm-fetch-pages` with `{ id: identifier }`. A spinner shows while the fetch runs (~1–3 s); the image strip populates with the result when it completes. No manual terminal command is needed.

**Route**: `app/api/admin/beitie/npm-fetch-pages/route.ts`

It runs two HTTP requests in parallel against NPM's public servers:

1. **HTML scrape** — fetches `entry.sourceUrl` (the collection detail page), regex-extracts all `/Image/GetImage?imageId=...&randomCode=...` `src` attributes, deduplicates, and **reverses** (NPM renders thumbnails last-to-first in the HTML).

2. **IIIF manifest** — calls `https://digitalarchive.npm.gov.tw/Integrate/GetJson?cid={cid}&dept={dep}&imageName=` extracted from the `sourceUrl`. Walks `sequences[0].canvases[].images[0].resource.service["@id"]` and appends `/full/full/0/default.jpg` for each canvas.

If either fetch finds images, the result is written back to `works_index.json` so subsequent lookups are instant. The route prefers `imagePages` (GetImage URLs) over `iiifPages` in the `pageUrls` response; the UI uses whichever is non-empty.

`pipeline/fetch_pages.py` still exists for **bulk backfill** (`python fetch_pages.py` with no args processes all un-fetched entries). The TypeScript route and the Python script implement identical logic and write to the same `works_index.json` file.

---

## Cover Image Selection

### Data model

The DB splits images into `cover_image` (single URL) and `pages_json` (JSON array). The detail page reconstructs the full ordered list as `[coverImage, ...pages]` — cover is always first.

### Admin UI design

Both the add and edit forms use a **decoupled cover index** pattern to let the admin pick any image as the cover without visually reordering the strip:

- `allImages = [form.coverImage, ...form.pages]` — the flat ordered list, always in original order
- `coverIdx: number` state — which index in `allImages` is the designated cover
- The strip renders `allImages` in order; the "封面" badge and accent border sit on `allImages[coverIdx]`
- Clicking any non-cover thumbnail sets `coverIdx` to that index (no reorder)
- At submit time only: `coverImage = allImages[coverIdx]`, `pages = allImages.filter(i !== coverIdx)`

This means `form.coverImage` / `form.pages` do **not** reflect the user's cover selection mid-session — they only reflect the original loaded order. The selection is applied at submit. Do not read `form.coverImage` to determine what the user wants as cover; read `allImages[coverIdx]` instead.

### coverIdx reset rules

`coverIdx` resets to 0 when:
- A new NPM work is selected (`selectNpmWork`)
- A cover image is uploaded via the file picker (`uploadFiles("cover", ...)`)
- The edit page finishes loading a record (data fetch `useEffect`)

`removeImage(idx)` keeps `coverIdx` valid:
- `idx < coverIdx` → `coverIdx--`
- `idx === coverIdx` → `coverIdx = 0`
- `idx > coverIdx` → no change

---

## Pages

| Route | File | What it does |
|-------|------|-------------|
| `/beitie` | `app/beitie/page.tsx` | Grid listing. Style filter hits `/api/beitie`. Text search is client-side on `items` array. |
| `/beitie/[id]` | `app/beitie/[id]/page.tsx` | Detail view. Hero image with lightbox (pinch-to-zoom + scroll-wheel zoom). Page thumbnail strip. AI tabs. |
| `/admin/beitie` | `app/admin/beitie/page.tsx` | Management list with AI status badge and delete. |
| `/admin/beitie/add` | `app/admin/beitie/add/page.tsx` | Create form. Two tabs: NPM lookup (auto-fills form + auto-fetches pages) or manual entry. |
| `/admin/beitie/[id]/edit` | `app/admin/beitie/[id]/edit/page.tsx` | Edit form. Includes AI generation panel with model selector and rate-limit feedback. |

All beitie pages are `"use client"` components — they fetch data client-side via the API routes.

---

## Key Pitfalls

1. **Async queries** — All beitie DB functions are `async`. Unlike the rest of the app, you must `await` them.

2. **No D1 in dev without credentials** — If `CF_ACCOUNT_ID`, `CF_API_TOKEN`, or `D1_DATABASE_ID` are missing, every query throws. Set these in `.env.local` to work with beitie locally.

3. **`tags` / `pages` serialization** — These columns are JSON strings in D1. `beitie-queries.ts` handles this automatically. Do not bypass the query layer and write raw SQL with un-serialized arrays.

4. **`upload-d1` is an upsert, not a push** — `POST /api/admin/beitie/[id]/upload-d1` does `INSERT ... ON CONFLICT DO UPDATE`. Since PATCH also writes to D1, this is now redundant but harmless. It also appends an `"uploaded"` tag.

5. **Style slugs are fixed** — The allowed slugs are `kai`, `xing`, `cao`, `li`, `zhuan`. There is no 金文 (bronze inscription) style in the beitie system — that exists only in the calligraphy dictionary.

6. **Gemini JSON parsing** — Gemini sometimes wraps its JSON output in markdown code fences (` ```json ... ``` `). The route strips these before parsing. If you add a new model, test that it also returns bare JSON or is handled by the strip logic.

7. **`updated_at` is set in SQL** — Never set `updated_at` in TypeScript. `updateBeitie` appends `updated_at = datetime('now')` to every `SET` clause.

8. **`form.coverImage` ≠ the user's chosen cover** — In the add/edit forms, `form.coverImage` is always the first image in the loaded order. The actual cover the user has chosen lives in `allImages[coverIdx]`. Only read `form.coverImage` for the image list, never to determine what to submit as the cover image.

9. **NPM fetch is fire-and-update, not blocking** — `selectNpmWork` sets the form immediately with whatever images are already cached, then fires the fetch. The form may update a second time when the fetch resolves. Do not assume `form.coverImage` / `form.pages` are final immediately after `selectNpmWork` is called.

10. **`works_index.json` is written by both TypeScript and Python** — The `npm-fetch-pages` route and `pipeline/fetch_pages.py` both write to `pipeline/data/works_index.json`. They implement the same logic; the Python script is for bulk backfill only. Don't add a third code path — extend one of the two existing ones.

---

## File Index

| Task | File |
|------|------|
| DB queries | `lib/db/beitie-queries.ts` |
| D1 HTTP client | `lib/db/d1-client.ts` |
| Public list API | `app/api/beitie/route.ts` |
| Public detail API | `app/api/beitie/[id]/route.ts` |
| Admin CRUD API | `app/api/admin/beitie/route.ts` + `[id]/route.ts` |
| AI generation (Gemini) | `app/api/admin/beitie/[id]/generate-ai/route.ts` |
| D1 upsert | `app/api/admin/beitie/[id]/upload-d1/route.ts` |
| R2 image upload | `app/api/admin/beitie/upload/route.ts` |
| NPM lookup | `app/api/admin/beitie/npm-lookup/route.ts` |
| NPM auto-fetch pages | `app/api/admin/beitie/npm-fetch-pages/route.ts` |
| Listing page | `app/beitie/page.tsx` |
| Detail page | `app/beitie/[id]/page.tsx` |
| Admin list | `app/admin/beitie/page.tsx` |
| Admin add form | `app/admin/beitie/add/page.tsx` |
| Admin edit form | `app/admin/beitie/[id]/edit/page.tsx` |
