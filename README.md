# 書法字典 (Chinese Calligraphy Dictionary)

A reference tool for calligraphers to look up how famous historical calligraphers wrote specific characters across different script styles (金文、小篆、隸書、楷書、行書、草書).

## Features

### 字典模式 (Dictionary)
Look up a single character and browse historical calligraphy examples across all 6 script styles. Filter by calligrapher or famous work.

### 集字工坊 (Jizi / Character Composition)
Type a phrase, pick a script style, and compose a visual reference board:
- **Layout**: Horizontal or vertical orientation, adjustable grid size and spacing
- **Paper styles**: Transparent, white, raw xuan paper, gold paper
- **Character effects**: Mi-zi grid, Jiu-gong grid, invert (rubbing style), wireframe, background removal
- **Borders**: Square or circular, customizable color and width
- **Export**: Save as high-resolution PNG

### 碑帖瀏覽 (Browse by Work/Calligrapher)
Browse all characters from a specific calligrapher or famous work, with infinite scroll and lightbox viewing.

### 個人中心 (My Collection)
- Save favorite characters
- Store and edit Jizi compositions
- Export saved works

### 管理後台 (Admin)
NPM (National Palace Museum) digital collection annotation workspace for processing and labeling stele/rubbing images.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database**: SQLite (via `better-sqlite3`) + Drizzle ORM
- **Image Storage**: Cloudflare R2 in production, local `public/images/` in dev
- **Authentication**: Firebase Auth (Google + Email/Password)
- **Data Scripts**: Python (dataset ingestion + scraping)
- **Deployment**: Fly.io + Docker

## Data Sources

### Primary Sources

- **zi.tools** — Web scraping from zi.tools API. Covers all 6 script styles including 金文 (bronze inscription). Rate-limited, non-commercial use only.
- **zhuojg/chinese-calligraphy-dataset** — Calligrapher-organized dataset with style and author metadata. Apache 2.0.
- **NPM (National Palace Museum) Open Data** — Digital collection of steles, rubbings, and calligraphy works for annotation and research.

### Ingestion Scripts

```bash
# zi.tools scraping (covers all 6 styles including 金文)
python scripts/scrape_zi_tools.py --chars "永和九年"

# Batch from text file
python scripts/scrape_zi_tools.py \
  --chars-file data/seed_texts/lan_ting_xu.txt \
  --output-dir public/images \
  --db data/shufazidian.db \
  --rate 2.0

# zhuojg dataset — folder names like 楷-柳公权 encode style + author/work
# Smoke test first:
python scripts/ingest_zhuojg.py \
  --calligrapher-dir data/zhuojg/chinese-calligraphy-dataset-with-calligrapher \
  --dry-run --limit 2

# Real ingest (idempotent: --clean-source resets DB rows for source=zhuojg):
python scripts/ingest_zhuojg.py \
  --calligrapher-dir data/zhuojg/chinese-calligraphy-dataset-with-calligrapher \
  --output-dir public/images --db data/shufazidian.db --clean-source
```

Python dependencies:
```bash
pip install requests Pillow tqdm opencc-python-reimplemented boto3 python-dotenv
```

`opencc-python-reimplemented` converts simplified character labels to traditional forms so they match the seeded characters table.

## Getting Started

```bash
npm install
npx drizzle-kit push                 # create SQLite schema
npx tsx scripts/seed_reference.ts    # seed styles, calligraphers, works
# Then run an ingestion script (see Data Sources above) to populate images.
npm run dev
```

Open http://localhost:3000.

## Environment Variables (`.env.local`)

Copy `.env.local.example` to `.env.local` and fill in the values.

```
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=shufazidian
R2_PUBLIC_URL=
USE_R2=false

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

**Firebase setup:** Create a project at [console.firebase.google.com](https://console.firebase.google.com), enable **Authentication** (Google + Email/Password providers) and **Firestore Database**, then copy the web app config values into `.env.local`.

The app only rewrites `<img>` URLs to the R2 bucket when `USE_R2=true` **and** `R2_PUBLIC_URL` is set. In development, keep `USE_R2` unset (or `false`) so images are served from `public/images/` — this lets you keep R2 credentials in `.env.local` without every image 404-ing against an empty bucket. In production, set both `USE_R2=true` and `R2_PUBLIC_URL` to your R2 public URL (or custom domain) after uploading images.

## Testing

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
```

The test suite covers:

| Area | File | What's tested |
|---|---|---|
| Pure utils | `__tests__/lib/utils.test.ts` | `charToUnicodeHex`, `resolveImageUrl` |
| Image resolution | `__tests__/lib/image-resolution.test.ts` | `resolveCurrentImage` — default image, alternative selection, stale-ID fallback, empty-array guard |
| API — 集字 | `__tests__/api/jizi.test.ts` | Character lookup, image URL resolution, calligrapher/work filters, missing chars |
| API — coverage | `__tests__/api/coverage.test.ts` | Facet data, found/not-found chars, style passthrough |
| `CalligraphyCharacter` | `__tests__/components/CalligraphyCharacter.test.tsx` | Image vs. text fallback, size, border shape, grid overlays |
| `JiziPicker` | `__tests__/components/JiziPicker.test.tsx` | API fetch, chip rendering, disabled chips, tab switching, search filter, toggle callbacks |
| `JiziPage` — images | `__tests__/components/JiziPage.test.tsx` | No broken images, text fallbacks, gallery alternative selection, stale selection after style switch |
| `JiziPage` — layout | `__tests__/components/JiziPage.layout.test.tsx` | `flex-wrap: wrap`, `max-width`, `overflow-auto`, fixed cell dimensions, `shrink-0`, 50-character stress test, grid-size slider |

API route tests mock `@/lib/db/queries` entirely — no SQLite required.

## Uploading Images to Cloudflare R2

```bash
# Dry run
python scripts/upload_to_r2.py --dry-run

# Upload (skips files already in R2, 8 parallel threads by default)
python scripts/upload_to_r2.py

# Tune parallelism for large runs
python scripts/upload_to_r2.py --workers 16

# Upload and delete local copies after success
python scripts/upload_to_r2.py --cleanup
```

## Deploying to Fly.io

The app is packaged for Fly.io. The populated `data/shufazidian.db` is baked into the Docker image at build time; image binaries live on Cloudflare R2. There is no persistent Fly volume — each `fly deploy` rebuilds the image with your latest local DB snapshot.

```bash
# 1. Install flyctl and log in
curl -L https://fly.io/install.sh | sh
fly auth login

# 2. Create the app (uses committed fly.toml — skip initial deploy)
fly launch --no-deploy --copy-config

# 3. Set R2 credentials as secrets
fly secrets set \
  R2_ENDPOINT="https://<account>.r2.cloudflarestorage.com" \
  R2_ACCESS_KEY_ID="..." \
  R2_SECRET_ACCESS_KEY="..." \
  R2_BUCKET_NAME="shufadictionary" \
  R2_PUBLIC_URL="https://pub-....r2.dev" \
  USE_R2="true"

# 4. Ensure the local DB is populated (the Dockerfile COPY will fail if not)
ls -lh data/shufazidian.db

# 5. Flush WAL contents into the main DB file before tarring up the build context
sqlite3 data/shufazidian.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 6. Deploy
fly deploy
```

On every boot the container runs `scripts/fly-migrate.mjs`, which applies any pending Drizzle migrations (tracked in a `__fly_migrations` table). This is idempotent.

## Updating Production Data

The DB is read-only at runtime on Fly. To ship new data:

```bash
# 1. Update the local DB
python scripts/scrape_zi_tools.py [...]
python scripts/ingest_zhuojg.py [...]

# 2. Push new image binaries to R2
python scripts/upload_to_r2.py --workers 16

# 3. Checkpoint WAL, then deploy
sqlite3 data/shufazidian.db "PRAGMA wal_checkpoint(TRUNCATE);"
fly deploy
```

Because `fly deploy` rebuilds the image from scratch, there is no migration between deploys — the DB is fully replaced with your local snapshot.

## Project Structure

```
shufazidian/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Home / 字典 mode (search)
│   ├── character/[char]/page.tsx # Character detail (style tabs + grid)
│   ├── jizi/page.tsx             # 集字 mode (phrase composition)
│   ├── browse/page.tsx           # 碑帖瀏覽 (by calligrapher/work)
│   ├── me/page.tsx               # 個人中心 (favorites + saved jizi)
│   ├── admin/                    # 管理後台 (NPM annotation)
│   └── api/
│       ├── search/
│       ├── character/[char]/images/
│       ├── calligraphers/
│       ├── works/
│       ├── jizi/
│       └── admin/npm/            # NPM data processing API
├── components/
│   ├── SearchBar.tsx             # Search input with IME handling
│   ├── StyleTabs.tsx             # 篆/隸/楷/行/草 tabs
│   ├── SubFilter.tsx             # 作者/作品/篩選
│   ├── ImageGrid.tsx             # Responsive grid
│   ├── ImageCard.tsx
│   ├── ImageModal.tsx            # Lightbox
│   ├── CalligraphyCharacter.tsx  # Single character tile with filters/grids
│   ├── JiziPicker.tsx            # Calligrapher/work filter sidebar
│   ├── FavoriteButton.tsx        # Favorite toggle
│   └── BottomNav.tsx             # 字典/碑帖/集字/我的
├── lib/
│   ├── db/schema.ts              # Drizzle schema
│   ├── db/index.ts               # DB connection
│   ├── db/queries.ts             # Reusable query helpers
│   ├── auth-context.tsx          # Firebase auth context
│   ├── favorites.ts              # Favorite management
│   ├── savedJizi.ts              # Saved jizi management
│   └── utils.ts                  # charToUnicodeHex, resolveImageUrl, resolveCurrentImage
├── __tests__/                    # Jest test suite
├── scripts/
│   ├── seed_reference.ts
│   ├── ingest_zhuojg.py
│   ├── scrape_zi_tools.py
│   ├── upload_to_r2.py
│   ├── fly-migrate.mjs           # Runtime SQL migrator
│   └── fly-start.sh              # Container entrypoint (migrate → server)
├── drizzle/                      # Committed Drizzle SQL migrations
├── jest.config.ts
├── jest.setup.ts
├── Dockerfile
├── fly.toml
└── data/                         # Local SQLite file (gitignored)
```

## Database Schema

| Table | Key columns |
|---|---|
| `characters` | `character`, `unicode_hex` |
| `script_styles` | `name_zh`, `slug` (金文 / 小篆 / 隸書 / 楷書 / 行書 / 草書) |
| `calligraphers` | `name_zh`, `name_en`, `dynasty` |
| `works` | famous pieces (蘭亭序, 祭姪文稿, …) with calligrapher + style |
| `calligraphy_images` | character + style + calligrapher + work + `image_path` |

## License

Non-commercial use only. Calligraphy images sourced from academic datasets and museum open data.