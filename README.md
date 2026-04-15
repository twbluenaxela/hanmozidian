# 書法字典 (Chinese Calligraphy Dictionary)

A reference tool for calligraphers to look up how famous historical calligraphers wrote specific characters in different script styles (篆書, 隸書, 楷書, 行書, 草書).

## Features

- **字典 mode** — Look up a character and browse historical calligraphy examples across all 5 script styles, filtered by calligrapher or famous work.
- **集字 mode** — Type a phrase, pick a script style, and compose a visual reference of each character (with the ability to cycle through different calligraphers' versions per character).

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database**: SQLite (via `better-sqlite3`) + Drizzle ORM for metadata
- **Image Storage**: Cloudflare R2 in production, local `public/images/` in dev
- **Data Scripts**: Python (for dataset ingestion + scraping)

## Getting Started

```bash
npm install
npx drizzle-kit push                 # create SQLite database schema
npx tsx scripts/seed_reference.ts    # seed styles, calligraphers, works
# Then run an ingestion script (see Data Sources below) to populate images.
npm run dev
Open http://localhost:3000.
Environment variables (.env.local)
code
Code
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=shufazidian
R2_PUBLIC_URL=
USE_R2=false
The app only rewrites <img> URLs to the R2 public bucket when USE_R2=true
AND R2_PUBLIC_URL is set. In development, keep USE_R2 unset (or false)
so images are served straight from public/images/ — this way you can keep
the upload-script credentials (R2_ENDPOINT, R2_ACCESS_KEY_ID, etc.) in
.env.local without every <img> 404ing against an empty R2 bucket. In
production, set both USE_R2=true and R2_PUBLIC_URL to your R2 public URL
(or custom domain) once you've uploaded images to R2.
Data Sources
The app is designed to be populated from multiple calligraphy datasets:
Primary datasets
MCCD — 329,715 images, 7,765 characters, 142 calligraphers, with script style and dynasty metadata. Requires application (CC BY-NC-ND 4.0).
zhuojg/chinese-calligraphy-dataset — 138,499 images, Apache 2.0.
Supplementary
Web scraping from sites like shufazidian.com and cidianwang.com (rate-limited, non-commercial use only).
Ingestion scripts
code
Bash
# Once you've downloaded MCCD LMDB files:
python scripts/ingest_mccd.py --lmdb-path /path/to/mccd/lmdb

# zhuojg — uses the calligrapher-organized half of the dataset
# (folder names like 楷-柳公权 encode style + author/work).
# Smoke test first:
python scripts/ingest_zhuojg.py \
  --calligrapher-dir data/zhuojg/chinese-calligraphy-dataset-with-calligrapher \
  --dry-run --limit 2

# Real ingest (idempotent re-runs: --clean-source resets DB rows for source=zhuojg):
python scripts/ingest_zhuojg.py \
  --calligrapher-dir data/zhuojg/chinese-calligraphy-dataset-with-calligrapher \
  --output-dir public/images --db data/shufazidian.db --clean-source

# Supplementary scraping:
python scripts/scrape_zi_tools.py --characters "永和九年"
Python dependencies:
code
Bash
pip install lmdb Pillow tqdm opencc-python-reimplemented requests beautifulsoup4 boto3 python-dotenv
opencc-python-reimplemented is used by ingest_zhuojg.py to convert
simplified character labels in the dataset to traditional forms so they
match the seeded characters table.
Uploading images to Cloudflare R2
Once ingestion has produced images under public/images/, upload them to R2:
code
Bash
# Dry run to see what would be uploaded
python scripts/upload_to_r2.py --dry-run

# Actually upload (skips files already in R2, 8 parallel threads by default)
python scripts/upload_to_r2.py

# Tune parallelism for bigger runs (e.g. the full zhuojg ingest at ~138k files)
python scripts/upload_to_r2.py --workers 16

# Upload and delete local copies after success
python scripts/upload_to_r2.py --cleanup
Deploying to Fly.io
The app is packaged for Fly.io. Metadata ships inside the Docker image (the populated data/shufazidian.db is baked in via COPY in the Dockerfile) and image binaries live on Cloudflare R2. There is no persistent Fly volume – each fly deploy rebuilds the image with the latest local DB snapshot.
code
Bash
# 1. Install flyctl and log in
curl -L https://fly.io/install.sh | sh
fly auth login

# 2. Create the app (uses the committed fly.toml — skip initial deploy)
fly launch --no-deploy --copy-config

# 3. Set R2 credentials as secrets (they're injected as env vars at runtime)
fly secrets set \
  R2_ENDPOINT="https://<account>.r2.cloudflarestorage.com" \
  R2_ACCESS_KEY_ID="..." \
  R2_SECRET_ACCESS_KEY="..." \
  R2_BUCKET_NAME="shufadictionary" \
  R2_PUBLIC_URL="https://pub-....r2.dev" \
  USE_R2="true"

# 4. Ensure data/shufazidian.db is populated locally FIRST (see Data Sources
#    above). The Dockerfile COPY will fail loudly if it isn't.
ls -lh data/shufazidian.db

# 5. Stop any local dev server or process holding the DB open, so WAL
#    contents are flushed into the main .db file before the build context
#    is tarred up. A quick way to force-checkpoint:
sqlite3 data/shufazidian.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 6. Deploy — rebuilds the image with the latest DB inside
fly deploy
On every boot the container runs scripts/fly-migrate.mjs, which reads the committed Drizzle migration files under drizzle/ and applies any pending ones to the baked-in DB (tracked in a __fly_migrations table). This is idempotent and safe to re-run.
Updating production data
The DB is read-only at runtime on Fly. To ship new data:
code
Bash
# 1. Update the local DB
python scripts/ingest_zhuojg.py [...]
python scripts/scrape_zi_tools.py [...]

# 2. Push new image binaries to R2
python scripts/upload_to_r2.py --workers 16

# 3. Checkpoint WAL -> main DB file, then deploy
sqlite3 data/shufazidian.db "PRAGMA wal_checkpoint(TRUNCATE);"
fly deploy
Because fly deploy rebuilds the image from scratch, there's no state to migrate between deploys — the DB is fully replaced with your local snapshot.
Project Structure
code
Code
shufazidian/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Home / 字典 mode (search)
│   ├── character/[char]/page.tsx # Character detail (style tabs + grid)
│   ├── jizi/page.tsx             # 集字 mode (phrase composition)
│   └── api/
│       ├── search/
│       ├── character/[char]/images/
│       ├── calligraphers/
│       ├── works/
│       └── jizi/
├── components/
│   ├── SearchBar.tsx             # Search input with IME handling
│   ├── StyleTabs.tsx             # 篆/隸/楷/行/草 tabs
│   ├── SubFilter.tsx             # 作者/作品/篩選
│   ├── ImageGrid.tsx             # Responsive grid
│   ├── ImageCard.tsx
│   ├── ImageModal.tsx            # Lightbox
│   └── BottomNav.tsx             # 字典/碑帖/集字/我的
├── lib/
│   ├── db/schema.ts              # Drizzle schema
│   ├── db/index.ts               # DB connection
│   ├── db/queries.ts             # Reusable query helpers
│   └── utils.ts
├── scripts/
│   ├── seed_reference.ts         # Seed styles, calligraphers, works
│   ├── ingest_mccd.py
│   ├── ingest_zhuojg.py
│   ├── scrape_zi_tools.py
│   ├── upload_to_r2.py
│   ├── fly-migrate.mjs           # Runtime SQL migrator (plain JS, no tsx)
│   └── fly-start.sh              # Container entrypoint (migrate → server)
├── drizzle/                      # Committed Drizzle SQL migrations
├── Dockerfile                    # Next.js 16 + better-sqlite3 multi-stage build
├── fly.toml                      # Fly.io app config (volume + env)
└── data/                         # Local SQLite file lives here (gitignored)
Database Schema
characters — character, unicode_hex
script_styles — 篆書 / 隸書 / 楷書 / 行書 / 草書
calligraphers — name_zh, name_en, dynasty
works — famous pieces (蘭亭序, 祭姪文稿, etc.) with calligrapher + style
calligraphy_images — character + style + calligrapher + work + image_path
License
Non-commercial use only. Calligraphy images sourced from academic datasets (MCCD is CC BY-NC-ND 4.0).