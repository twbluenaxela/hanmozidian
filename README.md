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
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables (`.env.local`)

```
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=shufazidian
R2_PUBLIC_URL=
USE_R2=false
```

The app only rewrites `<img>` URLs to the R2 public bucket when `USE_R2=true`
AND `R2_PUBLIC_URL` is set. In development, keep `USE_R2` unset (or `false`)
so images are served straight from `public/images/` — this way you can keep
the upload-script credentials (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, etc.) in
`.env.local` without every `<img>` 404ing against an empty R2 bucket. In
production, set both `USE_R2=true` and `R2_PUBLIC_URL` to your R2 public URL
(or custom domain) once you've uploaded images to R2.

## Data Sources

The app is designed to be populated from multiple calligraphy datasets:

### Primary datasets

1. **[MCCD](https://github.com/SCUT-DLVCLab/MCCD)** — 329,715 images, 7,765 characters, 142 calligraphers, with script style and dynasty metadata. Requires application (CC BY-NC-ND 4.0).
2. **[zhuojg/chinese-calligraphy-dataset](https://github.com/zhuojg/chinese-calligraphy-dataset)** — 138,499 images, Apache 2.0.

### Supplementary

- Web scraping from sites like `shufazidian.com` and `cidianwang.com` (rate-limited, non-commercial use only).

### Ingestion scripts

```bash
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
python scripts/scrape_shufazidian.py --characters "永和九年"
```

Python dependencies:

```bash
pip install lmdb Pillow tqdm opencc-python-reimplemented requests beautifulsoup4 boto3 python-dotenv
```

`opencc-python-reimplemented` is used by `ingest_zhuojg.py` to convert
simplified character labels in the dataset to traditional forms so they
match the seeded `characters` table.

### Uploading images to Cloudflare R2

Once ingestion has produced images under `public/images/`, upload them to R2:

```bash
# Dry run to see what would be uploaded
python scripts/upload_to_r2.py --dry-run

# Actually upload (skips files already in R2, 8 parallel threads by default)
python scripts/upload_to_r2.py

# Tune parallelism for bigger runs (e.g. the full zhuojg ingest at ~138k files)
python scripts/upload_to_r2.py --workers 16

# Upload and delete local copies after success
python scripts/upload_to_r2.py --cleanup
```

The script reads R2 credentials from `.env.local`. Once `R2_PUBLIC_URL` is set
and `USE_R2=true` is exported, the Next.js app serves images from R2 instead
of the local `public/` directory for any image whose path starts with
`images/`. Leave `USE_R2` unset on dev machines that haven't uploaded yet.

You can also test R2 connectivity with a small SVG upload:

```bash
npx tsx scripts/test_r2_connection.ts
```

## Deploying to Fly.io

The app is packaged for [Fly.io](https://fly.io) with a persistent SQLite volume
for metadata and Cloudflare R2 for images.

```bash
# 1. Install flyctl and log in
curl -L https://fly.io/install.sh | sh
fly auth login

# 2. Create the app (uses the committed fly.toml — skip initial deploy)
fly launch --no-deploy --copy-config

# 3. Create a 1GB persistent volume in your primary region (see fly.toml)
fly volumes create shufazidian_data --size 1 --region sjc

# 4. Set R2 credentials as secrets (they're injected as env vars at runtime)
fly secrets set \
  R2_ENDPOINT="https://<account>.r2.cloudflarestorage.com" \
  R2_ACCESS_KEY_ID="..." \
  R2_SECRET_ACCESS_KEY="..." \
  R2_BUCKET_NAME="shufadictionary" \
  R2_PUBLIC_URL="https://pub-....r2.dev" \
  USE_R2="true"

# 5. Deploy
fly deploy
```

On every boot the container runs `scripts/fly-migrate.mjs`, which reads the
committed Drizzle migration files under `drizzle/` and applies any that
haven't run yet (tracked in a `__fly_migrations` table). This is idempotent
and safe to re-run.

### Seeding production data

The Fly volume starts empty. To populate it:

- **Reference data** (styles, calligraphers, works) — run
  `npx tsx scripts/seed_reference.ts` against a local copy of the DB, then
  copy it onto the Fly volume, or run the script on Fly via
  `fly ssh console` (requires copying your dev `node_modules` up first — the
  simpler path is to build the DB locally and upload it).
- **Images** — run ingestion scripts locally, then push the generated images
  to Cloudflare R2 with `scripts/upload_to_r2.py`. The app reads directly
  from R2 via `R2_PUBLIC_URL`, so images don't need to live on the Fly
  volume at all.

### Updating the schema

When you change `lib/db/schema.ts`:

```bash
npx drizzle-kit generate   # writes a new drizzle/NNNN_*.sql
git add drizzle/ && git commit
fly deploy                 # migrator applies the new file on boot
```

## Project Structure

```
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
│   ├── scrape_shufazidian.py
│   ├── upload_to_r2.py
│   ├── fly-migrate.mjs           # Runtime SQL migrator (plain JS, no tsx)
│   └── fly-start.sh              # Container entrypoint (migrate → server)
├── drizzle/                      # Committed Drizzle SQL migrations
├── Dockerfile                    # Next.js 16 + better-sqlite3 multi-stage build
├── fly.toml                      # Fly.io app config (volume + env)
└── data/                         # Local SQLite file lives here (gitignored)
```

## Database Schema

- **characters** — `character`, `unicode_hex`
- **script_styles** — 篆書 / 隸書 / 楷書 / 行書 / 草書
- **calligraphers** — `name_zh`, `name_en`, `dynasty`
- **works** — famous pieces (蘭亭序, 祭姪文稿, etc.) with calligrapher + style
- **calligraphy_images** — character + style + calligrapher + work + image_path

## License

Non-commercial use only. Calligraphy images sourced from academic datasets (MCCD is CC BY-NC-ND 4.0).
