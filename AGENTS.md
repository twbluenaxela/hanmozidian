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

### 字元 key 的重要規則（Unicode 正確性）
- 兩個 ingest 腳本都**直接使用來源字元**作為 DB key，**不做 s2t 轉換**。
- 原因：s2t 轉換會把多個正體變體（裏/裡/里、鬆/松、禦/御 等）合併到同一個 key，導致不同字的圖片混雜在一起。
- 如果要抓取某個特定字（如 裏 U+88CF），請直接傳入該字，**不要依賴轉換**：
  ```bash
  python scripts/scrape_zi_tools.py --chars "裏裡里"  # 分別抓取三個字
  ```
- `lib/s2t.ts` 的搜尋層仍保留 s2t fallback（先精確比對，找不到才轉換），支援使用者輸入簡體字。

### 字元變體管理
- `data/variant_groups.json` — 177 個簡/繁變體群組，按圖片總數排序。
- `scripts/curate_variants.py` — 互動式整理工具，可將圖片重新指派到正確字元。
- `data/variant_groups_progress.json` — 整理進度（由腳本自動維護）。
- 整理完畢後執行 `./deploy.sh`。

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

## 11. HuggingFace ML Pipeline

### 背景與核心問題

草書字元偵測面臨根本性的「先有雞還是先有蛋」問題：

- OpenCV 投影法（`process.py`）依賴字元之間的墨水間隙。楷書/隸書有間隙，可以運作。
- 草書沒有間隙——相鄰字的筆劃物理上連接（牽絲）。純視覺分割無法找到邊界。
- **結論**：草書分割本質上需要識別。沒有語義理解就無法知道邊界在哪裡。

正確的方法是**強制對齊（Forced Alignment）**：給模型圖像 AND 已知的釋文字符序列，要求它定位每個字元。這與語音識別中的強制對齊（對齊音頻與已知文本）原理相同。

### 現有 HuggingFace 腳本

| 腳本 | 功能 | 狀態 |
|------|------|------|
| `pipeline/hf_validate.py` | 驗證：送出個別字元圖塊，問模型「這是不是字 X？」| 已有 |
| `pipeline/hf_segment.py` | 強制對齊：送出整欄圖像 + 釋文序列，要求模型定位每個字元 | 已有 |

**為什麼 hf_validate.py 方向是錯的**：先裁切再問「這是不是 X？」假設裁切已經正確。對草書而言裁切本身就是問題。`hf_segment.py` 才是正確方向。

### 執行強制對齊實驗

```bash
source .venv/bin/activate

# 找一個已標注的草書作品（status=done 且有 annotationDraft）
# 先跑 2 欄測試，--debug 輸出視覺化圖像
python pipeline/hf_segment.py --id 贈書00043100000 --limit 2 --debug

# 看結果
explorer.exe pipeline/data/processed/  # 找 hf_segment_debug.jpg
# 綠框 = 人工標注（ground truth），藍框 = VLM 預測
```

輸出指標：
- **IoU ≥ 0.5**（✓）= 良好對齊
- **IoU 0.3–0.5**（~）= 部分對齊
- **IoU < 0.3**（✗）= 未命中

預測結果存於 `processed/<safe>/hf_segment_boxes.json`。

### 目前資料狀況（截至 2026-05-11）

| 書體 | 圖像數 | 唯一字元 | 已標注作品 |
|------|--------|---------|-----------|
| 楷書 | 77,208 | 6,876 | 多 |
| 行書 | 70,501 | 6,735 | 多 |
| 草書 | 18,972 | 2,861 | **6 件** |
| 隸書 | 35,447 | 6,464 | 多 |

草書字元分布（嚴重不均）：
- ≥50 個範例：3 個字
- 10–49 個範例：723 個字
- 5–9 個範例：717 個字
- 1–4 個範例：1,418 個字

**約 28 個已標注欄位**（6 件作品 × 平均 ~5 欄）。

### 訓練自己的模型：需求與路線圖

#### 階段一：繼續用 HF Inference API（現在，免費）

使用 `hf_validate.py` 和 `hf_segment.py` 對接 HuggingFace 無伺服器推論 API（免費，有速率限制）。主要目的：
- 累積實驗數據，了解 VLM 在草書上的能力極限
- 用 IoU 評估建立評估體系
- 繼續標注更多草書作品

**模型選擇**：`Qwen/Qwen2.5-VL-7B-Instruct`（對中文字元理解最佳的開放模型）

#### 階段二：微調字元分類器（需要 ~500 個已標注欄位）

**目標**：一個能對裁切後的草書字元圖塊進行分類的模型。

**需求**：
- **資料量**：每個常用字至少 20–50 個範例（目前多數字只有 2–9 個）
- **估計需要**：再標注 25–50 件草書作品（目前有 6 件）
- **計算資源**：Google Colab 免費 T4 GPU 足夠微調小模型
- **基礎模型候選**：
  - `microsoft/trocr-base-handwritten` — 專為手寫文字識別設計
  - `google/vit-base-patch16-224` — 通用圖像分類 ViT，可在字元圖塊上微調
- **HuggingFace 工具**：`transformers.Trainer` + `datasets` 函式庫

**資料格式**（HuggingFace Dataset）：
```python
# 每條記錄
{
  "image": PIL.Image,   # 256×256 WebP 字元圖塊（已在 export.py 中產生）
  "label": "之",        # Unicode 字元
  "style": "cao",       # 書體
  "calligrapher": "王羲之",
}
```

已存在的 256×256 WebP 圖像（`public/images/cao/`）可直接用作訓練資料。

#### 階段三：強制對齊模型（需要 ~1,000 個已標注欄位）

**目標**：輸入整欄圖像 + 釋文字序列，輸出每個字的邊界框。這才是真正解決草書分割問題的模型。

**需求**：
- **資料量**：至少 500–1,000 個已標注欄位（每欄有 ground-truth 邊界框 + 字序列）
- **估計需要**：再標注 50–100 件草書作品
- **計算資源**：需要比 Colab 免費版更多的資源（建議用 Colab Pro 或 Kaggle Notebooks）
- **基礎模型候選**：
  - `Qwen/Qwen2.5-VL-2B-Instruct`（2B 參數，可在有限資源下微調）
  - 或自訂 DETR-based 偵測頭接在 ViT backbone 上

**現有 `annotationDraft` 資料就是訓練資料**：每件標注完成的作品已提供欄位圖像 + 字序列 + 邊界框，格式完全匹配訓練需求。

#### 模型訓練後的部署

訓練完成的模型可推送到 HuggingFace Hub（免費存放），然後：
- 通過 HF Inference API 呼叫（若模型夠小）
- 或在本機/Docker 容器中執行推論

### 關鍵規則

- **不要在草書上用 process.py 的 OpenCV 投影法**，改用 `--force-split` 或 `hf_segment.py`
- **hf_validate.py 對草書用處有限**——驗證已裁切的圖塊，但草書的問題在裁切本身
- **HUGGINGFACE_API_KEY** 從 `.env.local` 讀取（參見 `.env.local.example`）
- **訓練資料就在 `public/images/cao/`**——18,972 張 256×256 WebP，可直接用於分類器訓練
- **評估指標用 IoU**：`hf_segment.py` 已實作，可當作所有後續模型評估的基準

---

*完整專案摘要請見 `SUMMARY.md`，使用說明請見 `README.md`*
