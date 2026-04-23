# 書法字典 (Shufazidian) — Codebase Summary

> 這是一份給開發者與 AI 助理的完整程式碼庫摘要。它涵蓋了專案架構、資料流、關鍵設計決策、以及各個模組的職責。閱讀本文件後，你應該能夠定位到任何功能對應的程式碼位置。

---

## 1. 專案概述

**書法字典**是一個線上書法參考工具，讓使用者查詢歷代名家如何書寫特定漢字，涵蓋六種書體：金文、小篆、隸書、楷書、行書、草書。

### 核心功能模組

| 模組 | 路徑 | 說明 |
|------|------|------|
| 字典模式 | `app/page.tsx` → `app/character/[char]/page.tsx` | 單字查詢，分書體瀏覽歷代範例 |
| 集字工坊 | `app/jizi/page.tsx` | 輸入詞句，選擇書體，生成排版參考圖 |
| 碑帖瀏覽 | `app/browse/page.tsx` | 按書家或碑帖作品瀏覽，無限捲動 |
| 個人中心 | `app/me/page.tsx` | 收藏字、儲存的集字作品 |
| 管理後台 | `app/admin/` | NPM（故宮博物院）數位典藏圖片標註工作區 |

---

## 2. 技術棧與架構

```
Frontend:    Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
Database:    SQLite (better-sqlite3) + Drizzle ORM
Auth:        Firebase Auth (Google + Email/Password)
Images:      Cloudflare R2 (S3-compatible) in prod / local public/images in dev
Scripts:     Python 3 (data scraping & ingestion)
Testing:     Jest + React Testing Library + jsdom
Deployment:  Fly.io + Docker + Litestream (DB replication)
```

### 關鍵版本資訊

- **Next.js 16.2.3** — 使用 App Router，注意這是較新的版本，部分 API 可能與你熟悉的 Next.js 不同
- **React 19.2.4** — 使用新的 JSX transform，無需手動 import React
- **Tailwind CSS v4** — 使用 `@tailwindcss/postcss` 而非傳統的 `tailwindcss` 插件
- **Drizzle ORM 0.45.2** — 類型安全的 SQL 查詢構建器
- **better-sqlite3 12.8.0** — 同步 SQLite 驅動，WAL 模式已啟用

---

## 3. 資料庫架構

定義於 `lib/db/schema.ts`，遷移檔位於 `drizzle/`。

### 表格

| 表格 | 用途 | 關鍵欄位 |
|------|------|---------|
| `characters` | 收錄的漢字 | `character` (TEXT, PK), `unicode_hex` |
| `script_styles` | 六種書體 | `name_zh`, `slug` (金文/小篆/隸書/楷書/行書/草書) |
| `calligraphers` | 書家資訊 | `name_zh`, `name_en`, `dynasty` |
| `works` | 著名碑帖作品 | `title`, FK 到 `calligraphers` 與 `script_styles` |
| `calligraphy_images` | 核心圖片表 | FK 到以上所有表格 + `image_path`, `source` (zi.tools / zhuojg / npm) |

### 索引策略

`calligraphy_images` 上有大量複合索引，支援快速篩選：
- `(character_id, script_style_id)` — 字典模式查詢
- `(character_id, script_style_id, calligrapher_id)` — 按書家篩選
- `(character_id, script_style_id, work_id)` — 按作品篩選

### 連線設定 (`lib/db/index.ts`)

- 使用 `better-sqlite3` 同步驅動
- 啟用 WAL 模式（`PRAGMA journal_mode = WAL`）
- 啟用外鍵約束（`PRAGMA foreign_keys = ON`）
- DB 路徑解析相對於 `process.cwd()`，確保 `data/` 目錄存在
- 包含 Fly.io 部署時的檔案大小診斷日誌

---

## 4. 資料流與資料來源

### 4.1 資料來源

| 來源 | 腳本 | 內容 | 授權 |
|------|------|------|------|
| **zi.tools** | `scripts/scrape_zi_tools.py` | 六體書法圖片（含金文），base64 PNG | 非商業使用，有速率限制 |
| **zhuojg/chinese-calligraphy-dataset** | `scripts/ingest_zhuojg.py` | 按書家分類的書法圖片 | Apache 2.0 |
| **NPM 故宮開放資料** | `app/api/admin/npm/` + `app/admin/annotate/` | 碑帖、拓片數位圖片 | 研究用途 |

### 4.2 資料處理流程

```
原始資料
    │
    ├─→ scrape_zi_tools.py ──→ 正規化（灰階、裁切、256px WebP）──→ public/images/ + SQLite
    │
    ├─→ ingest_zhuojg.py ───→ 分類資料夾名稱（楷-柳公權）──────→ public/images/ + SQLite
    │
    └─→ admin annotate ─────→ 人工標註 NPM 圖片 ──────────────→ SQLite

    ↓

upload_to_r2.py ──→ 上傳到 Cloudflare R2（生產環境）

    ↓

npm run build ──→ Dockerfile COPY data/shufazidian.db ──→ Fly.io 部署
```

### 4.3 圖片路徑解析 (`lib/utils.ts`)

```typescript
resolveImageUrl(imagePath: string): string
```

- 開發環境（`USE_R2=false` 或未設定）：直接回傳 `/images/...`，由 Next.js 從 `public/images/` 提供
- 生產環境（`USE_R2=true` + `R2_PUBLIC_URL` 設定）：重寫為 `R2_PUBLIC_URL/images/...`

---

## 5. API 路由一覽

所有 API 位於 `app/api/` 下，使用 Next.js App Router 的 Route Handlers。

| 路由 | 檔案 | 功能 | 請求參數 |
|------|------|------|---------|
| `GET /api/search` | `app/api/search/route.ts` | 搜尋漢字，回傳各書體圖片數量 | `q=<string>` |
| `GET /api/character/[char]/images` | `app/api/character/[char]/images/route.ts` | 取得特定字元的書法圖片 | `style`, `calligrapher`, `work`, `page`, `limit` |
| `GET /api/jizi` | `app/api/jizi/route.ts` | 集字查詢：輸入詞句，回傳每個字對應的圖片 | `text`, `style`, `calligrapher`, `work` |
| `GET /api/jizi/coverage` | `app/api/jizi/coverage/route.ts` | 檢查詞句中每個字的覆蓋率 | `text`, `style` |
| `GET /api/calligraphers` | `app/api/calligraphers/route.ts` | 書家列表 | — |
| `GET /api/works` | `app/api/works/route.ts` | 作品列表 | `calligrapher_id`, `style_id` |
| `GET /api/browse` | `app/api/browse/route.ts` | 碑帖瀏覽資料 | `calligrapher_id`, `work_id`, `style_id`, `page` |
| `GET /api/admin/npm` | `app/api/admin/npm/route.ts` | NPM 資料包列表 | — |
| `GET /api/admin/npm/[id]` | `app/api/admin/npm/[identifier]/route.ts` | 單一 NPM 資料包 | `identifier` |
| `POST /api/admin/npm/[id]/process` | `app/api/admin/npm/[identifier]/process/route.ts` | 處理 NPM 資料包 | `identifier` (body: 處理選項) |
| `GET /api/admin/npm-image/[id]` | `app/api/admin/npm-image/[identifier]/route.ts` | 提供 NPM 圖片 | `identifier` |

### 查詢層 (`lib/db/queries.ts`)

所有資料庫查詢都封裝在這裡，約 10 個 exported functions：

- `searchCharacters(query)` — LIKE 搜尋
- `getCharacterByChar(char)` — 精確查字
- `getStyleCounts(charId)` — 按書體分組計數
- `getImages(...)` — 主圖片查詢，支援多層篩選
- `getJiziImages(text, styleId, ...)` — 集字專用查詢
- `getCalligraphers()`, `getWorks(...)`, `getBrowseImages(...)` 等

**設計決策**：API 測試（`__tests__/api/`）mock 整個 `@/lib/db/queries` 模組，因此測試不需要 SQLite 資料庫。

---

## 6. 前端頁面與元件

### 6.1 頁面結構

```
app/
├── layout.tsx              # Root layout：AuthProvider + BottomNav + 主題 CSS 變數
├── page.tsx                # 首頁：搜尋框 + 熱門字網格
├── character/[char]/
│   └── page.tsx            # 字典詳情頁：書體分頁 + 圖片網格 + 篩選側邊欄
├── jizi/
│   └── page.tsx            # 集字工坊：最複雜的頁面（~575 行）
├── browse/
│   └── page.tsx            # 碑帖瀏覽：無限捲動 + 燈箱
├── me/
│   └── page.tsx            # 個人中心：收藏 + 儲存的集字
└── admin/
    ├── page.tsx            # 管理後台首頁
    └── annotate/
        └── page.tsx        # NPM 圖片標註工作區
```

### 6.2 核心元件

| 元件 | 檔案 | 職責 |
|------|------|------|
| `SearchBar` | `components/SearchBar.tsx` | 搜尋輸入，支援中文輸入法（IME）處理 |
| `StyleTabs` | `components/StyleTabs.tsx` | 六書體分頁切換 |
| `ImageGrid` | `components/ImageGrid.tsx` | 響應式圖片網格 |
| `ImageCard` | `components/ImageCard.tsx` | 單張圖片卡片 |
| `ImageModal` | `components/ImageModal.tsx` | 燈箱（lightbox）檢視 |
| `CalligraphyCharacter` | `components/CalligraphyCharacter.tsx` | 集字單字方塊：支援米字格、九宮格、反白、線框、去背等效果 |
| `JiziPicker` | `components/JiziPicker.tsx` | 集字側邊欄：書家/作品篩選 + 字元選擇 |
| `FavoriteButton` | `components/FavoriteButton.tsx` | 收藏切換按鈕 |
| `BottomNav` | `components/BottomNav.tsx` | 底部導航：字典 / 碑帖 / 集字 / 我的 |
| `ZitieModal` | `components/ZitieModal.tsx` | 字帖模態框 |
| `SubFilter` | `components/SubFilter.tsx` | 次級篩選元件 |

### 6.3 集字工坊 (`app/jizi/page.tsx`) — 最複雜的頁面

這是專案中最複雜的頁面（約 575 行），功能包括：

1. **文字輸入**：使用者輸入中文詞句
2. **書體選擇**：六體擇一
3. **圖片獲取**：透過 `/api/jizi` 為每個字取得書法圖片
4. **排版設定**：
   - 方向：橫式 / 直式
   - 網格大小與間距
   - 紙張樣式：透明、白紙、生宣、灑金紙
5. **字元效果**：
   - 米字格、九宮格輔助線
   - 反白（拓片風格）
   - 線框模式
   - 背景去背
6. **邊框**：方形或圓形，可調顏色與寬度
7. **匯出**：使用 `html-to-image` 生成高解析度 PNG

### 6.4 狀態管理

- **認證**：`lib/auth-context.tsx` — Firebase Auth Context，提供 `user`, `loading`, `signIn`, `signOut`
- **收藏**：`lib/favorites.ts` — 與 Firestore 同步的收藏功能
- **儲存集字**：`lib/savedJizi.ts` — 儲存/載入集字排版設定
- **圖片重試**：`lib/useImageRetry.ts` — 圖片載入失敗時自動重試

---

## 7. 測試策略

測試位於 `__tests__/` 目錄，使用 Jest + React Testing Library。

| 測試檔案 | 測試內容 |
|---------|---------|
| `__tests__/lib/utils.test.ts` | `charToUnicodeHex`, `resolveImageUrl` |
| `__tests__/lib/image-resolution.test.ts` | `resolveCurrentImage` — 預設圖、替代選擇、過期 ID fallback |
| `__tests__/lib/favorites.test.ts` | 收藏功能邏輯 |
| `__tests__/lib/savedJizi.test.ts` | 儲存集字邏輯 |
| `__tests__/lib/auth-context.test.tsx` | 認證 context |
| `__tests__/api/jizi.test.ts` | 集字 API：字元查詢、圖片 URL 解析、篩選、缺字處理 |
| `__tests__/api/coverage.test.ts` | 覆蓋率 API：facet 資料、找到/未找到的字 |
| `__tests__/components/CalligraphyCharacter.test.tsx` | 單字方塊：圖片 vs 文字 fallback、大小、邊框形狀、格線 |
| `__tests__/components/JiziPicker.test.tsx` | 集字選擇器：API 獲取、chip 渲染、禁用狀態、分頁切換 |
| `__tests__/components/JiziPage.test.tsx` | 集字頁：無破圖、文字 fallback、圖庫替代選擇 |
| `__tests__/components/JiziPage.layout.test.tsx` | 集字頁排版：`flex-wrap`, `max-width`, 固定格尺寸、50 字壓力測試 |
| `__tests__/components/FavoriteButton.test.tsx` | 收藏按鈕 |
| `__tests__/components/MePage.test.tsx` | 個人中心頁面 |
| `__tests__/admin/annotate.test.tsx` | 標註頁面 |

**重要**：API 路由測試完全 mock `@/lib/db/queries`，不需要 SQLite 資料庫即可執行。

---

## 8. 部署與運維

### 8.1 Fly.io 部署流程

```bash
# 1. 確保本機 DB 已填充
ls -lh data/shufazidian.db

# 2. 將 WAL 內容寫入主檔案
sqlite3 data/shufazidian.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 3. 部署（Dockerfile 會 COPY data/shufazidian.db）
fly deploy
```

**關鍵設計**：
- DB 在執行時是唯讀的
- 每次 `fly deploy` 都會用本機 DB 快照完全重建映像檔
- 沒有持久化 Fly volume，因此不需要跨部署的遷移
- 啟動時執行 `scripts/fly-migrate.mjs`：應用任何待處理的 Drizzle 遷移（記錄在 `__fly_migrations` 表中，冪等）
- 使用 Litestream 進行 DB 複製（`@flydotio/litestream`）

### 8.2 更新生產資料

```
1. 在本機執行爬蟲/匯入腳本更新 DB
2. 執行 upload_to_r2.py 上傳新圖片
3. WAL checkpoint + fly deploy
```

### 8.3 Docker 設定

- `Dockerfile`：多階段建置，Node.js 20，複製 `data/shufazidian.db`
- `fly.toml`：Fly.io 設定，包含環境變數與服務設定
- `scripts/fly-start.sh`：容器入口腳本（遷移 → 啟動伺服器）

---

## 9. 腳本工具箱

### Python 腳本（資料處理）

| 腳本 | 用途 | 常用指令 |
|------|------|---------|
| `scripts/scrape_zi_tools.py` | 從 zi.tools 爬取書法圖片 | `python scripts/scrape_zi_tools.py --chars "永和九年"` |
| `scripts/ingest_zhuojg.py` | 匯入 zhuojg 資料集 | `python scripts/ingest_zhuojg.py --calligrapher-dir ... --clean-source` |
| `scripts/upload_to_r2.py` | 上傳圖片到 Cloudflare R2 | `python scripts/upload_to_r2.py --workers 16 --cleanup` |
| `scripts/generate_gallery.py` | 生成圖庫預覽 HTML | — |
| `scripts/audit_calligraphers.py` | 審計書家資料 | — |
| `scripts/fix_calligraphers.py` | 修復書家資料 | — |
| `scripts/scrape_corpus.py` | 爬取語料庫 | — |

### TypeScript/Node 腳本

| 腳本 | 用途 |
|------|------|
| `scripts/seed_reference.ts` | 種子資料：六書體、書家、作品基礎資料 |
| `scripts/fly-migrate.mjs` | Fly.io 啟動時執行的遷移腳本 |
| `scripts/fly-start.sh` | 容器入口腳本 |
| `scripts/test_r2_connection.ts` | 測試 R2 連線 |

---

## 10. 環境變數

複製 `.env.local.example` 為 `.env.local`：

```
# R2 物件儲存（生產環境圖片）
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=shufazidian
R2_PUBLIC_URL=https://pub-....r2.dev
USE_R2=false          # 開發設 false，生產設 true

# Firebase 認證
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**開發 vs 生產圖片策略**：
- 開發：`USE_R2=false` → 圖片從 `public/images/` 提供
- 生產：`USE_R2=true` + `R2_PUBLIC_URL` 設定 → 圖片 URL 重寫為 R2 公開 URL

---

## 11. 常見工作流

### 新增一個字的書法圖片

```bash
# 1. 爬取
python scripts/scrape_zi_tools.py --chars "新字" --output-dir public/images --db data/shufazidian.db

# 2. （可選）上傳到 R2
python scripts/upload_to_r2.py --dry-run
python scripts/upload_to_r2.py

# 3. 本地開發已可直接看到，生產需部署
sqlite3 data/shufazidian.db "PRAGMA wal_checkpoint(TRUNCATE);"
fly deploy
```

### 新增書家或作品

直接編輯 `scripts/seed_reference.ts` 中的種子資料陣列，然後執行：

```bash
npx tsx scripts/seed_reference.ts
```

### 執行測試

```bash
npm test           # 單次執行
npm run test:watch # 監看模式
```

---

## 12. 已知限制與注意事項

1. **zi.tools 速率限制**：爬蟲有內建延遲（`--rate 2.0` 表示每秒 2 個請求），過快會被封鎖
2. **DB 唯讀**：Fly.io 生產環境中 DB 是唯讀的，所有寫入必須在本機完成後部署
3. **圖片大小**：所有圖片正規化為 256px WebP，控制儲存空間
4. **Next.js 15+ async params**：`app/character/[char]/page.tsx` 使用 `use(params)` 解構 async params
5. **WAL 模式**：本機開發時 SQLite 使用 WAL 模式，部署前必須執行 `wal_checkpoint(TRUNCATE)` 確保所有資料寫入主檔案

---

## 13. 檔案索引速查

| 想找什麼 | 去哪裡 |
|---------|--------|
| 資料庫表格定義 | `lib/db/schema.ts` |
| 資料庫查詢函數 | `lib/db/queries.ts` |
| 圖片 URL 解析邏輯 | `lib/utils.ts` |
| 認證邏輯 | `lib/auth-context.tsx` |
| 收藏功能 | `lib/favorites.ts` |
| 集字儲存 | `lib/savedJizi.ts` |
| 首頁 | `app/page.tsx` |
| 字典詳情頁 | `app/character/[char]/page.tsx` |
| 集字工坊 | `app/jizi/page.tsx` |
| 碑帖瀏覽 | `app/browse/page.tsx` |
| 個人中心 | `app/me/page.tsx` |
| 管理後台 | `app/admin/annotate/page.tsx` |
| 搜尋 API | `app/api/search/route.ts` |
| 集字 API | `app/api/jizi/route.ts` |
| 字元圖片 API | `app/api/character/[char]/images/route.ts` |
| 爬蟲腳本 | `scripts/scrape_zi_tools.py` |
| 資料匯入 | `scripts/ingest_zhuojg.py` |
| R2 上傳 | `scripts/upload_to_r2.py` |
| 種子資料 | `scripts/seed_reference.ts` |
| 測試 | `__tests__/` |
| 部署設定 | `Dockerfile`, `fly.toml` |

---

*最後更新：2025-04-24*
