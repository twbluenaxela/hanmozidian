# 碑帖 Page — Integration Guide

## Files to create / modify

| File in this folder | Copy to your codebase |
|---|---|
| `1_migration.sql` | Run against your SQLite DB (or add to Drizzle migrations) |
| `2_beitie-queries.ts` | → `lib/db/beitie-queries.ts` |
| `3_api-beitie-route.ts` | → `app/api/beitie/route.ts` |
| `4_api-beitie-id-route.ts` | → `app/api/beitie/[id]/route.ts` |
| `5_beitie-page.tsx` | → `app/beitie/page.tsx` |
| `6_beitie-id-page.tsx` | → `app/beitie/[id]/page.tsx` |
| `7_BottomNav-diff.tsx` | Edit `components/BottomNav.tsx` — add one nav item |

---

## Step-by-step

### 1 — Run the migration
```bash
sqlite3 your.db < beitie/integration/1_migration.sql
```
Or paste the `CREATE TABLE` block into your Drizzle schema and run `drizzle-kit push`.

### 2 — Copy query helpers
```bash
cp beitie/integration/2_beitie-queries.ts lib/db/beitie-queries.ts
```
Adjust the `import { db } from "@/lib/db"` line to match how you export your db instance.

### 3 — Add API routes
```
app/api/beitie/route.ts          ← copy from 3_api-beitie-route.ts
app/api/beitie/[id]/route.ts     ← copy from 4_api-beitie-id-route.ts
```

### 4 — Add pages
```
app/beitie/page.tsx              ← copy from 5_beitie-page.tsx
app/beitie/[id]/page.tsx         ← copy from 6_beitie-id-page.tsx
```

### 5 — Update BottomNav
Open `components/BottomNav.tsx`, add a `{ href: "/beitie", label: "碑帖" }` entry.
See `7_BottomNav-diff.tsx` for the SVG icon.

---

## Adding your first 碑帖

Use a quick script or the sqlite3 CLI:
```sql
INSERT INTO beitie (title, author, dynasty, style, style_slug, year_label, summary, tags)
VALUES ('蘭亭集序', '王羲之', '東晉', '行書', 'xing', '353年',
        '天下第一行書', '["天下第一行書","永字八法"]');
```

Then trigger AI generation by calling:
```
POST /api/beitie/1
```
from your admin panel (or curl). The route calls Claude and saves all 6 sections to the DB.

---

## Uploading images

- Set `cover_image` to an R2 URL (same pattern as your existing `imagePath` / `resolveImageUrl`).
- Set `pages_json` to a JSON array of R2 URLs for multi-page pieces.
- The detail page renders them automatically — cover first, then pages as thumbnails.

---

## No changes needed to
- `globals.css` — the pages use your existing CSS variables
- `layout.tsx` — BottomNav is already rendered there
- Any existing queries — beitie is a standalone table
