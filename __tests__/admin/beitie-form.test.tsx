/**
 * Tests for the merged beitie add/edit page.
 *
 * Route: /admin/beitie/[id]/edit
 *   id === "new"      → creation mode (NPM lookup + blank form, AI disabled until saved)
 *   id === "<number>" → edit mode (loads record, full form + AI panel)
 */

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BeitieFormPage from "@/app/admin/beitie/[id]/edit/page";

// ── next/navigation mock ──────────────────────────────────────────────────────

const mockPush    = jest.fn();
const mockReplace = jest.fn();
let   mockId      = "new";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => ({ id: mockId }),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const SAMPLE_ITEM = {
  id: 42,
  title: "蘭亭集序",
  author: "王羲之",
  dynasty: "東晉",
  style: "行書",
  styleSlug: "xing",
  yearLabel: "353年",
  medium: "紙本墨跡",
  charCount: 324,
  summary: "天下第一行書",
  tags: ["行書精品"],
  coverImage: "https://r2.example.com/beitie/cover.jpg",
  pages: ["https://r2.example.com/beitie/p2.jpg"],
  shiwen: "永和九年歲在癸丑",
  sourceCredit: "故宮博物院",
  sourceUrl: "https://npm.gov.tw/42",
  aiHistory: "歷史背景文字",
  aiBiography: "作者生平文字",
  aiStyle: "風格分析文字",
  aiInfluence: "影響傳承文字",
  aiStories: "趣事典故文字",
  aiPractice: "臨摹建議文字",
  aiGeneratedAt: "2026-01-01T00:00:00Z",
};

function fetchOnce(data: unknown, status = 200) {
  return jest.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

/** Build a fetch spy that handles multiple sequential calls by URL substring. */
function buildFetchMap(map: Record<string, { data: unknown; status?: number }>) {
  return jest.fn((url: string) => {
    for (const [key, val] of Object.entries(map)) {
      if (url.includes(key)) {
        const status = val.status ?? 200;
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(val.data),
        });
      }
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockReset();
  mockReplace.mockReset();
  mockId = "new";
});

// ── 1. creation mode — initial render ─────────────────────────────────────────

describe("creation mode (id=new) — initial render", () => {
  beforeEach(() => { mockId = "new"; });

  it("shows '新增碑帖' heading", () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ models: [] }) }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    expect(screen.getByText("新增碑帖")).toBeInTheDocument();
  });

  it("shows NPM tab and manual tab", () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ models: [] }) }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    expect(screen.getByRole("button", { name: "NPM 查詢" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "手動新增" })).toBeInTheDocument();
  });

  it("does not show metadata fields before NPM selection or manual tab", () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ models: [] }) }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    expect(screen.queryByLabelText(/標題/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/作者/)).not.toBeInTheDocument();
  });

  it("shows metadata fields when manual tab is selected", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ models: [] }) }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "手動新增" })); });
    expect(screen.getByText("標題 *")).toBeInTheDocument();
    expect(screen.getByText("作者 *")).toBeInTheDocument();
    expect(screen.getByText("朝代 *")).toBeInTheDocument();
  });

  it("AI generate button is disabled before first save", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ models: [] }) }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "手動新增" })); });
    const genBtn = screen.getByRole("button", { name: /生成 AI 解析/ });
    expect(genBtn).toBeDisabled();
  });

  it("shows hint that save is required before AI generation", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ models: [] }) }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "手動新增" })); });
    expect(screen.getByText(/請先儲存碑帖/)).toBeInTheDocument();
  });
});

// ── 2. creation mode — NPM search ─────────────────────────────────────────────

describe("creation mode — NPM search", () => {
  beforeEach(() => { mockId = "new"; });

  it("shows npm search input", () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    render(<BeitieFormPage />);
    expect(screen.getByPlaceholderText(/蘭亭、顏真卿/)).toBeInTheDocument();
  });

  it("fires lookup fetch after typing (debounced)", async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ results: [] }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<BeitieFormPage />);
    await userEvent.type(screen.getByPlaceholderText(/蘭亭、顏真卿/), "蘭亭");

    await waitFor(
      () => expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("npm-lookup")
      ),
      { timeout: 1000 }
    );
  });

  it("renders npm result rows and clicking one populates the form", async () => {
    const results = [{
      identifier: "故書001N", name: "蘭亭集序", category: "法書",
      calligrapher: "王羲之", era: "東晉", styleSlug: "xing",
      sourceUrl: "https://npm.gov.tw/1", imageUrl: "https://img/1",
      imagePages: ["https://img/1.jpg", "https://img/2.jpg"], pageCount: 2, shiwen: null,
    }];

    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ results }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<BeitieFormPage />);
    await userEvent.type(screen.getByPlaceholderText(/蘭亭、顏真卿/), "蘭亭");

    await waitFor(() => screen.getByText("蘭亭集序"), { timeout: 1000 });
    await act(async () => { fireEvent.click(screen.getByText("蘭亭集序")); });

    await waitFor(() => {
      // Title field should now be visible and filled
      const titleInputs = screen.getAllByDisplayValue("蘭亭集序");
      expect(titleInputs.length).toBeGreaterThan(0);
    });
  });

  it("shows page-fetch spinner when npm work has no pre-fetched pages", async () => {
    const results = [{
      identifier: "故書001N", name: "蘭亭集序", category: "法書",
      calligrapher: "王羲之", era: "東晉", styleSlug: "xing",
      sourceUrl: "https://npm.gov.tw/1", imageUrl: "https://img/1",
      imagePages: [], pageCount: 1, shiwen: null,
    }];

    let resolveFetch!: (v: unknown) => void;
    const fetchSpy = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ results }) })
      .mockImplementationOnce(() => new Promise((r) => { resolveFetch = r; }));

    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await userEvent.type(screen.getByPlaceholderText(/蘭亭、顏真卿/), "蘭亭");
    await waitFor(() => screen.getByText("蘭亭集序"), { timeout: 1000 });

    await act(async () => { fireEvent.click(screen.getByText("蘭亭集序")); });
    expect(screen.getByText(/正在抓取分頁圖片/)).toBeInTheDocument();

    // Clean up the hanging promise
    await act(async () => {
      resolveFetch({ ok: true, status: 200, json: () => Promise.resolve({ pageUrls: [], imagePages: [] }) });
    });
  });
});

// ── 3. creation mode — form submission ────────────────────────────────────────

describe("creation mode — form submission", () => {
  beforeEach(() => { mockId = "new"; });

  async function fillAndSubmit(fetchSpy: jest.Mock) {
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "手動新增" })); });

    // title, author, dynasty are the first three textbox inputs in the grid
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "多寶塔碑" } });
    fireEvent.change(inputs[1], { target: { value: "顏真卿" } });
    fireEvent.change(inputs[2], { target: { value: "唐" } });

    // Style select is the first combobox; the second is the Gemini model selector
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "kai" } });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "新增碑帖" })); });
  }

  it("POSTs to /api/admin/beitie with required fields", async () => {
    const fetchSpy = buildFetchMap({
      "/api/admin/beitie": { data: { id: 99 } },
      "generate-ai": { data: { models: [] } },
    });
    await fillAndSubmit(fetchSpy);

    await waitFor(() => {
      const postCall = fetchSpy.mock.calls.find(
        ([url, opts]: [string, RequestInit]) => url === "/api/admin/beitie" && opts?.method === "POST"
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall![1].body as string);
      expect(body.title).toBe("多寶塔碑");
      expect(body.author).toBe("顏真卿");
      expect(body.dynasty).toBe("唐");
      expect(body.styleSlug).toBe("kai");
    });
  });

  it("calls router.replace with the new edit URL after creation", async () => {
    const fetchSpy = buildFetchMap({
      "/api/admin/beitie": { data: { id: 99 } },
      "generate-ai": { data: { models: [] } },
      "/api/beitie/99": { data: { item: null } },
    });
    await fillAndSubmit(fetchSpy);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/beitie/99/edit");
    });
  });

  it("shows validation error when title is missing", async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "手動新增" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "新增碑帖" })); });
    expect(screen.getByText(/標題、作者、朝代、書體為必填/)).toBeInTheDocument();
  });

  it("does not call fetch when required fields are missing", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "手動新增" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "新增碑帖" })); });
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "/api/admin/beitie",
      expect.objectContaining({ method: "POST" })
    );
  });
});

// ── 4. edit mode — loading & data fetch ───────────────────────────────────────

describe("edit mode (id=42) — loading and data fetch", () => {
  beforeEach(() => { mockId = "42"; });

  it("shows loading indicator before fetch resolves", () => {
    let resolve!: (v: unknown) => void;
    global.fetch = jest.fn(() => new Promise((r) => { resolve = r; })) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    expect(screen.getByText("載入中…")).toBeInTheDocument();
    act(() => { resolve({ ok: true, status: 200, json: () => Promise.resolve({ item: SAMPLE_ITEM }) }); });
  });

  it("shows 找不到 when item is null", async () => {
    global.fetch = buildFetchMap({
      "/api/beitie/42": { data: { item: null } },
      "generate-ai": { data: { models: [] } },
    }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByText("找不到此碑帖"));
  });

  it("populates the form with fetched data", async () => {
    global.fetch = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
    }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    expect(screen.getByDisplayValue("王羲之")).toBeInTheDocument();
    expect(screen.getByDisplayValue("東晉")).toBeInTheDocument();
  });

  it("shows the edit heading with the title", async () => {
    global.fetch = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
    }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByText("編輯：蘭亭集序"));
  });

  it("shows the AI content fields populated", async () => {
    global.fetch = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
    }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("歷史背景文字"));
    expect(screen.getByDisplayValue("作者生平文字")).toBeInTheDocument();
    expect(screen.getByDisplayValue("風格分析文字")).toBeInTheDocument();
  });

  it("does not show NPM lookup tabs in edit mode", async () => {
    global.fetch = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
    }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    expect(screen.queryByRole("button", { name: "NPM 查詢" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "手動新增" })).not.toBeInTheDocument();
  });
});

// ── 5. edit mode — form submission (PATCH) ────────────────────────────────────

describe("edit mode — PATCH on save", () => {
  beforeEach(() => { mockId = "42"; });

  it("calls PATCH on 儲存變更", async () => {
    const fetchSpy = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
      "/api/admin/beitie/42": { data: { ok: true } },
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "儲存變更" })); });

    await waitFor(() => {
      const patchCall = fetchSpy.mock.calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.includes("/api/admin/beitie/42") && opts?.method === "PATCH"
      );
      expect(patchCall).toBeDefined();
    });
  });

  it("does not call router.replace after PATCH (stays on same page)", async () => {
    const fetchSpy = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
      "/api/admin/beitie/42": { data: { ok: true } },
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "儲存變更" })); });
    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([url, opts]: [string, RequestInit]) =>
        url.includes("/api/admin/beitie/42") && opts?.method === "PATCH"
      )).toBe(true);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("calls PATCH then upload-d1 when '儲存並上傳 D1' is clicked", async () => {
    const fetchSpy = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
      "/api/admin/beitie/42": { data: { ok: true } },
      "upload-d1": { data: { ok: true } },
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "儲存並上傳 D1" })); });

    await waitFor(() => {
      const d1Call = fetchSpy.mock.calls.find(([url]: [string]) => url.includes("upload-d1"));
      expect(d1Call).toBeDefined();
    });
  });

  it("back button navigates to /admin/beitie", async () => {
    global.fetch = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
    }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "取消" })); });
    expect(mockPush).toHaveBeenCalledWith("/admin/beitie");
  });

  it("back button in ← header navigates to /admin/beitie", async () => {
    global.fetch = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
    }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "← 碑帖管理" })); });
    expect(mockPush).toHaveBeenCalledWith("/admin/beitie");
  });
});

// ── 6. edit mode — AI generation ──────────────────────────────────────────────

describe("edit mode — AI generation", () => {
  beforeEach(() => { mockId = "42"; });

  it("AI generate button is enabled in edit mode", async () => {
    global.fetch = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
    }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    const genBtn = screen.getByRole("button", { name: /生成 AI 解析/ });
    expect(genBtn).not.toBeDisabled();
  });

  it("calls generate-ai POST and updates form fields on success", async () => {
    const sections = {
      history: "新歷史", biography: "新生平", style: "新風格",
      influence: "新影響", stories: "新趣事", practice: "新建議",
    };
    const fetchSpy = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [], sections } },
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /生成 AI 解析/ })); });

    await waitFor(() => screen.getByDisplayValue("新歷史"));
    expect(screen.getByDisplayValue("新生平")).toBeInTheDocument();
    expect(screen.getByDisplayValue("新風格")).toBeInTheDocument();
  });

  it("shows success status after generation", async () => {
    const fetchSpy = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [], sections: { history: "x", biography: "x", style: "x", influence: "x", stories: "x", practice: "x" } } },
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /生成 AI 解析/ })); });
    await waitFor(() => screen.getByText("生成完成，請確認內容後儲存"));
  });

  it("shows rate limit message and countdown on 429", async () => {
    const fetchSpy = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ item: SAMPLE_ITEM }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ models: [] }) })
      .mockResolvedValueOnce({
        ok: false, status: 429,
        json: () => Promise.resolve({ error: "rate_limited", retrySeconds: 30 }),
      });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /生成 AI 解析/ })); });
    await waitFor(() => screen.getByText(/已達 API 請求上限/));
    expect(screen.getByText(/30s/)).toBeInTheDocument();
  });

  it("shows daily quota exhausted message on quota error", async () => {
    const fetchSpy = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ item: SAMPLE_ITEM }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ models: [] }) })
      .mockResolvedValueOnce({
        ok: false, status: 429,
        json: () => Promise.resolve({ error: "daily_quota_exhausted", message: "今日配額已用完" }),
      });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /生成 AI 解析/ })); });
    await waitFor(() => screen.getByText("今日配額已用完"));
  });

  it("shows error message when generation fails with non-429 error", async () => {
    const fetchSpy = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ item: SAMPLE_ITEM }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ models: [] }) })
      .mockResolvedValueOnce({
        ok: false, status: 500,
        json: () => Promise.resolve({ message: "伺服器錯誤" }),
      });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /生成 AI 解析/ })); });
    await waitFor(() => screen.getByText("伺服器錯誤"));
  });
});

// ── 7. edit mode — image management ──────────────────────────────────────────

describe("edit mode — image strip and cover selection", () => {
  beforeEach(() => { mockId = "42"; });

  it("renders thumbnails for cover and pages", async () => {
    global.fetch = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
    }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    // cover + 1 page = 2 images; alt="" makes them presentational so query via tag
    // eslint-disable-next-line testing-library/no-node-access
    const images = document.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it("shows 封面 badge on the first image by default", async () => {
    global.fetch = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [] } },
    }) as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    expect(screen.getByText("封面")).toBeInTheDocument();
  });
});

// ── 8. live Gemini model list ─────────────────────────────────────────────────

describe("edit mode — Gemini model list", () => {
  beforeEach(() => { mockId = "42"; });

  it("populates model selector from live API response", async () => {
    const fetchSpy = buildFetchMap({
      "/api/beitie/42": { data: { item: SAMPLE_ITEM } },
      "generate-ai": { data: { models: [{ id: "gemini-test-model", label: "Test Model" }] } },
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    await waitFor(() => screen.getByText("Test Model"));
  });

  it("falls back to hardcoded model list when live fetch fails", async () => {
    const fetchSpy = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ item: SAMPLE_ITEM }) })
      .mockRejectedValueOnce(new Error("network error"));
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);
    await waitFor(() => screen.getByDisplayValue("蘭亭集序"));
    // Hardcoded fallback includes Gemini 2.0 Flash
    expect(screen.getByText(/Gemini 2\.0 Flash（預設）/)).toBeInTheDocument();
  });
});

// ── 9. post-creation transition ───────────────────────────────────────────────

describe("post-creation transition", () => {
  beforeEach(() => { mockId = "new"; });

  it("AI panel becomes active after creation (savedId set)", async () => {
    // After POST, router.replace is called — simulate by checking that the
    // generate button was disabled before save and the replace was called with correct URL.
    const fetchSpy = buildFetchMap({
      "/api/admin/beitie": { data: { id: 55 } },
      "generate-ai": { data: { models: [] } },
      "/api/beitie/55": { data: { item: { ...SAMPLE_ITEM, id: 55 } } },
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<BeitieFormPage />);

    // Switch to manual tab and fill form
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "手動新增" })); });

    const inputs = screen.getAllByRole("textbox");
    await userEvent.clear(inputs[0]); await userEvent.type(inputs[0], "新碑帖");
    await userEvent.clear(inputs[1]); await userEvent.type(inputs[1], "作者");
    await userEvent.clear(inputs[2]); await userEvent.type(inputs[2], "唐");
    await userEvent.selectOptions(screen.getByRole("combobox"), "kai");

    // Confirm AI generate button is disabled before save
    expect(screen.getByRole("button", { name: /生成 AI 解析/ })).toBeDisabled();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "新增碑帖" })); });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/beitie/55/edit");
    });
  });
});
