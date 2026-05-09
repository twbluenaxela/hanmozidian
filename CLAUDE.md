# CLAUDE.md — AI Assistant Context for 翰墨字典

> 這份文件提供給 AI 助理（如 Claude）的快速專案上下文。閱讀此文件後，你應該能在不讀取整個程式碼庫的情況下，理解專案架構並做出正確的修改。

## 專案概述

**翰墨字典 (Hanmodict)** — 一個線上書法參考工具，讓使用者查詢歷代名家如何書寫特定漢字，涵蓋六種書體（金文、小篆、隸書、楷書、行書、草書）。

## 技術棧（關鍵版本）

- **Next.js 16.2.3** (App Router) — ⚠️ 這是較新版本，API 可能與你熟悉的 Next.js 不同
- **React 19.2.4** — 新的 JSX transform，無需 `import React`
- **Tailwind CSS v4** — 使用 `@tailwindcss/postcss`
- **Drizzle ORM 0.45.2** + **better-sqlite3 12.8.0** (同步 SQLite)
- **Firebase Auth** (Google + Email/Password)
- **Cloudflare R2** (S3-compatible) for production images
- **PWA** — installable via `app/manifest.ts`; network-only (no service worker)

## 設計系統 & 文件

- **→ `STYLE.md`** — 統一視覺語言：色盤、字體、互動元件、動畫、佈局原則。UI 工作前必讀。
- **→ `app/AGENT.md`** — 首頁架構與設計決策（為什麼用 mounted guard、為什麼用 `<img>` 而非 `<Image>` 等）。

## 關鍵檔案位置

| 想找什麼 | 去哪裡 |
|---------|--------|
| 資料庫 schema | `lib/db/schema.ts` |
| 資料庫查詢 | `lib/db/queries.ts` |
| 圖片 URL 解析 | `lib/utils.ts` |
| 認證 context | `lib/auth-context.tsx` |
| 收藏功能 | `lib/favorites.ts` |
| 集字儲存 | `lib/savedJizi.ts` |
| 首頁 | `app/page.tsx` |
| 首頁架構文件 | `app/AGENT.md` |
| 字典詳情頁 | `app/character/[char]/page.tsx` |
| 字典詳情頁 + ZitieModal 架構文件 | `app/character/AGENT.md` |
| 字帖生成器 | `components/ZitieModal.tsx` |
| 集字工坊（最複雜頁面） | `app/jizi/page.tsx` |
| 碑帖瀏覽 | `app/browse/page.tsx` |
| 碑帖藏品清單 | `app/beitie/page.tsx` |
| 碑帖詳情頁 | `app/beitie/[id]/page.tsx` |
| 碑帖架構文件 | `app/beitie/AGENT.md` |
| 碑帖資料庫查詢 | `lib/db/beitie-queries.ts` |
| Cloudflare D1 客戶端 | `lib/db/d1-client.ts` |
| 碑帖管理後台 | `app/admin/beitie/page.tsx` |
| 個人中心 | `app/me/page.tsx` |
| 管理後台（隊列） | `app/admin/page.tsx` |
| 管理後台（標注畫布） | `app/admin/annotate/page.tsx` |
| 管理後台架構文件 | `app/admin/AGENT.md` |
| OpenCV 字元偵測 pipeline 架構文件 | `pipeline/AGENT.md` |
| PWA manifest | `app/manifest.ts` |
| PWA icons | `public/icon-192.png`, `public/icon-512.png` |
| 搜尋 API | `app/api/search/route.ts` |
| 集字 API | `app/api/jizi/route.ts` |
| 字元圖片 API | `app/api/character/[char]/images/route.ts` |
| 爬蟲腳本 | `scripts/scrape_zi_tools.py` |
| 資料匯入 | `scripts/ingest_zhuojg.py` |
| 字元變體群組 | `data/variant_groups.json` |
| 變體整理工具 | `scripts/curate_variants.py` |
| R2 上傳 | `scripts/upload_to_r2.py` |
| 種子資料 | `scripts/seed_reference.ts` |
| 部署腳本（含 WAL checkpoint） | `deploy.sh` |
| 測試 | `__tests__/` |
| 完整程式碼庫摘要 | `SUMMARY.md` |

## 常見程式碼模式

### 新增 API Route

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic"; // 如果需要動態渲染

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  // ... 查詢邏輯
  return NextResponse.json({ data });
}
```

### 新增資料庫查詢

```typescript
// lib/db/queries.ts
import { db } from "./index";
import { calligraphyImages } from "./schema";
import { eq, and } from "drizzle-orm";

export function getExample(charId: number, styleId: number) {
  return db
    .select()
    .from(calligraphyImages)
    .where(and(
      eq(calligraphyImages.characterId, charId),
      eq(calligraphyImages.scriptStyleId, styleId)
    ))
    .all();
}
```

### 新增頁面（App Router）

```typescript
// app/example/page.tsx
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "頁面標題 | 書法字典",
};

export default function ExamplePage() {
  return <div>...</div>;
}
```

### 動態路由（Next.js 15+ async params）

```typescript
// app/character/[char]/page.tsx
import { use } from "react";

export default function CharacterPage({ params }: { params: Promise<{ char: string }> }) {
  const { char } = use(params);
  // ...
}
```

### 圖片 URL 解析

```typescript
import { resolveImageUrl } from "@/lib/utils";

const imageUrl = resolveImageUrl(image.imagePath);
// 開發：/images/...  |  生產：https://r2-public-url/images/...
```

## 測試模式

- 使用 Jest + React Testing Library
- API 測試 mock `@/lib/db/queries` — **不需要 SQLite 資料庫**
- 元件測試使用 `jest-environment-jsdom`
- 執行：`npm test` 或 `npm run test:watch`

## 部署注意事項

- **Fly.io app**: `hanmozidian` — live at https://hanmozidian.fly.dev
- **GitHub repo**: `git@github.com:twbluenaxela/hanmozidian.git`
- **DB 檔案**: `data/shufazidian.db`（本機檔案尚未更名，程式碼路徑與此一致）
- DB 在生產環境是**唯讀**的 — 所有寫入必須在本機完成後部署
- **永遠用 `./deploy.sh` 部署，不要直接用 `fly deploy`**
  - `deploy.sh` 會先執行 WAL checkpoint，再呼叫 `fly deploy`
  - `.dockerignore` 排除了 `*.db-wal`，若跳過 checkpoint，WAL 中的新資料不會進入 Docker image，導致生產環境資料比本機少
- 每次 `fly deploy` 會用本機 DB 快照完全重建映像檔
- 圖片儲存在 Cloudflare R2，DB 只存 metadata

## 資料流

```
原始資料 → Python 腳本 → public/images/ + SQLite → upload_to_r2.py → R2
                                    ↓
                              fly deploy → Docker image with DB
```

## 環境變數

複製 `.env.local.example` → `.env.local`，填入：
- R2 憑證（生產圖片儲存）
- Firebase 設定（認證）
- `USE_R2=false`（開發）/ `true`（生產）
- `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `D1_DATABASE_ID`（碑帖 D1 查詢必需）
- `GEMINI_API_KEY`（碑帖 AI 解析生成必需）

## 碑帖 (Beitie) 子系統

碑帖是一個獨立的子系統，資料庫、圖片前綴、查詢層都與主應用分離。有完整的架構文件：

**→ `app/beitie/AGENT.md`**

任何涉及 `app/beitie/`、`app/admin/beitie/`、`app/api/beitie/`、`app/api/admin/beitie/` 或 `lib/db/beitie-queries.ts` 的工作，請先閱讀該文件。

關鍵重點：
- 資料儲存於 **Cloudflare D1**（不是本機 SQLite）
- 所有查詢函數是 **`async`**，必須 `await`（與主應用的同步查詢相反）
- `tags` 和 `pages` 在 D1 中以 JSON 字串儲存
- AI 解析使用 **Google Gemini**（不是 Claude），需要 `GEMINI_API_KEY`
- 圖片上傳到 R2 的 `beitie/` 前綴

## 管理後台子系統

管理標注系統有獨立的架構文件，包含完整的資料模型、API 參考、pipeline 操作和常見陷阱：

**→ `app/admin/AGENT.md`**

任何涉及 `app/admin/`、`app/api/admin/npm/` 或 `pipeline/` 的工作，請先閱讀該文件。

關鍵重點：
- 標注資料儲存於 `pipeline/data/works_index.json`（**不是** SQLite DB）
- 多頁捲軸需先執行 `python pipeline/fetch_pages.py` 才能抓取所有頁面 URL（或在 UI 開啟作品時自動執行）
- Box 的字元是按**繪製順序**（非空間位置）分配的
- `annotationDraft` 在 JSON 中是雙重編碼的字串
- **偵測字框**（"偵測"按鈕）只針對當前頁面執行，結果合併進該頁的框，不影響其他頁面
- `PATCH /api/admin/npm` 設定 `status: "done"` 時，若作品已 `uploaded: true`，會自動重設為 `uploaded: false`，確保重新標注後能正常匯出
- `pipeline/` 目錄在 `.gitignore` 中，需用 `git add -f` 強制追蹤指令稿檔案

## 重要提醒

1. **Next.js 16 有 breaking changes** — 寫任何 Next.js 相關程式碼前，先查 `node_modules/next/dist/docs/`
2. **better-sqlite3 是同步的** — 所有 Drizzle 查詢都是同步的，不需要 `await`
3. **WAL 模式** — 本機開發時 SQLite 使用 WAL；`*.db-wal` 被 `.dockerignore` 排除，所以部署時一定要透過 `./deploy.sh`（會自動 checkpoint），否則 WAL 裡的新資料不會進入生產環境
4. **zi.tools 有速率限制** — 爬蟲內建延遲，不要移除它
5. **圖片正規化** — 所有圖片統一為 256px WebP
6. **ingest 腳本不做字元 s2t 轉換** — `scrape_zi_tools.py` 和 `ingest_zhuojg.py` 直接用來源字元作為 DB key，不轉換。這樣才能正確區分 裏/裡/里、鬆/松 等變體。搜尋層（`lib/s2t.ts`）仍保留 s2t fallback 供使用者輸入簡體字。

---

*完整詳情請見 `SUMMARY.md` 和 `README.md`*
