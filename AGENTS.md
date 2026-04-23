<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Rules for 書法字典 (Shufazidian)

> 這份文件補充 `CLAUDE.md` 和 `SUMMARY.md`，提供給 AI 助理在修改程式碼時必須遵守的規則與慣例。

## 1. 技術棧約束

- **Next.js 16.2.3** — 使用 App Router。寫任何 Next.js API 前，先確認 `node_modules/next/dist/docs/` 中的文件。
- **React 19.2.4** — 不需要 `import React`。使用新的 JSX transform。
- **Tailwind CSS v4** — 使用 `@tailwindcss/postcss`，不是傳統的 `tailwindcss` 插件。不要寫 `tailwind.config.js`。
- **Drizzle ORM 0.45.2** — 類型安全的查詢構建器。所有查詢封裝在 `lib/db/queries.ts`。
- **better-sqlite3 12.8.0** — **同步** SQLite 驅動。Drizzle 查詢是同步的，**不要加 `await`**。
- **TypeScript 5** — 嚴格模式。所有新程式碼必須有完整型別。

## 2. 資料庫規則

### 新增表格
1. 在 `lib/db/schema.ts` 定義 schema
2. 執行 `npx drizzle-kit generate` 產生遷移檔
3. 執行 `npx drizzle-kit push` 應用到本機 DB
4. 提交遷移檔到 `drizzle/`

### 新增查詢
- 所有查詢函數放在 `lib/db/queries.ts`
- 使用 Drizzle 的型安全 API（`eq`, `and`, `or`, `like`）
- 複合查詢條件使用 `and()` / `or()`
- 回傳型別必須明確宣告或推導

### 索引
- `calligraphy_images` 表已經有大量複合索引
- 新增查詢前，先檢查現有索引是否已覆蓋
- 需要新索引時，在 schema 定義中使用 `.index()`

## 3. API 路由規則

### 檔案位置
- 所有 API 放在 `app/api/` 下，使用 Route Handlers (`route.ts`)
- 動態段使用 `[param]/route.ts`

### 必須的匯出
```typescript
export const dynamic = "force-dynamic"; // 如果涉及 DB 查詢或動態資料
```

### 請求處理
```typescript
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  // ...
  return NextResponse.json({ data });
}
```

### 錯誤處理
- 使用 `try/catch` 包覆 DB 查詢
- 回傳標準錯誤格式：`{ error: string }`，HTTP 狀態碼 400/404/500

## 4. 前端規則

### 頁面元件
- 使用 Server Components 作為預設
- 需要互動時才使用 Client Component（`'use client'`）
- 動態路由參數使用 `use(params)`（Next.js 15+ 模式）

### 元件設計
- 所有元件放在 `components/` 目錄
- 使用 TypeScript interface 定義 props
- 優先使用 Server Component，減少 client-side JavaScript

### 圖片處理
- 永遠使用 `resolveImageUrl()` 解析圖片路徑（`lib/utils.ts`）
- 不要直接拼接 `/images/` 路徑
- 圖片載入失敗時有 fallback 機制（參考 `CalligraphyCharacter.tsx`）

## 5. 測試規則

### 新增測試
- 測試檔放在 `__tests__/` 目錄，鏡像原始檔結構
- API 測試 mock `@/lib/db/queries` — **不要真的連接 DB**
- 元件測試使用 `@testing-library/react` + `jest-environment-jsdom`

### 測試命名
```
__tests__/api/example.test.ts      → API 路由測試
__tests__/components/Example.test.tsx → 元件測試
__tests__/lib/example.test.ts       → 工具函數測試
```

### 執行測試
```bash
npm test        # 單次
npm run test:watch  # 監看模式
```

## 6. 資料處理規則

### 新增書法圖片
1. 使用 `scripts/scrape_zi_tools.py` 或 `scripts/ingest_zhuojg.py`
2. 圖片會自動正規化為 256px WebP
3. 執行 `upload_to_r2.py` 上傳到 R2（生產環境）
4. 部署前執行 `sqlite3 data/shufazidian.db "PRAGMA wal_checkpoint(TRUNCATE);"`

### 新增書家/作品
1. 編輯 `scripts/seed_reference.ts`
2. 執行 `npx tsx scripts/seed_reference.ts`

### 速率限制
- `scrape_zi_tools.py` 有內建延遲（預設 `--rate 2.0`）
- **不要移除或降低延遲**，會被封鎖

## 7. 部署規則

### 生產部署前檢查清單
- [ ] 本機 DB 已更新且驗證
- [ ] `sqlite3 data/shufazidian.db "PRAGMA wal_checkpoint(TRUNCATE);"` 已執行
- [ ] 新圖片已上傳到 R2（`upload_to_r2.py`）
- [ ] 測試通過（`npm test`）
- [ ] 遷移檔已提交（`drizzle/`）

### 部署指令
```bash
npm run deploy  # 包含 WAL checkpoint + fly deploy
```

## 8. 環境變數

- 開發時 `USE_R2=false` — 圖片從 `public/images/` 提供
- 生產時 `USE_R2=true` + `R2_PUBLIC_URL` 設定
- Firebase 設定全部需要 `NEXT_PUBLIC_` 前綴（client-side 使用）

## 9. 禁止事項

- ❌ 不要在 API 路由中使用 `fs` 直接讀寫檔案（除了已存在的模式）
- ❌ 不要在生產環境寫入 SQLite（DB 是唯讀的）
- ❌ 不要移除 `scrape_zi_tools.py` 的速率限制
- ❌ 不要寫 `tailwind.config.js`（使用 Tailwind v4 的 CSS-based 配置）
- ❌ 不要在 Drizzle 查詢上加 `await`（better-sqlite3 是同步的）
- ❌ 不要直接拼接 `/images/` URL — 永遠使用 `resolveImageUrl()`

## 10. 檔案索引

| 任務 | 檔案 |
|------|------|
| 新增 DB 表格 | `lib/db/schema.ts` → `drizzle-kit generate` |
| 新增查詢 | `lib/db/queries.ts` |
| 新增 API | `app/api/.../route.ts` |
| 新增頁面 | `app/.../page.tsx` |
| 新增元件 | `components/....tsx` |
| 新增測試 | `__tests__/.../....test.ts(x)` |
| 新增腳本 | `scripts/....py` 或 `scripts/....ts` |
| 更新種子資料 | `scripts/seed_reference.ts` |
| 圖片 URL 解析 | `lib/utils.ts` |
| 認證邏輯 | `lib/auth-context.tsx` |
| 收藏邏輯 | `lib/favorites.ts` |
| 集字儲存 | `lib/savedJizi.ts` |

---

*完整專案摘要請見 `SUMMARY.md`，使用說明請見 `README.md`*
