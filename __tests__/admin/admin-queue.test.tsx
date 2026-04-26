/**
 * Tests for app/admin/page.tsx — the admin queue / list view.
 *
 * Covers initial fetch, filter wiring, search, navigation, status badges,
 * empty state, and fetch errors.
 */

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminPage from "@/app/admin/page";

// ── next/navigation mock ──────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

interface Work {
  identifier: string;
  name: string;
  category: string;
  calligrapher: string | null;
  era: string;
  styleSlug: string | null;
  shiwen: string | null;
  status: "pending" | "processing" | "annotating" | "done" | "skipped";
  updatedAt: string;
}

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    identifier: "npm-001",
    name: "蘭亭序",
    category: "法書",
    calligrapher: "王羲之",
    era: "東晉",
    styleSlug: null,
    shiwen: "永和九年",
    status: "pending",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

interface ResponsePayload {
  works?: Work[];
  statusCounts?: Record<string, number>;
  categoryCounts?: Record<string, number>;
  total?: number;
}

function mockFetchOk(payload: ResponsePayload) {
  const fetchSpy = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  });
  global.fetch = fetchSpy as unknown as typeof fetch;
  return fetchSpy;
}

/** Returns the URL string passed to the most recent fetch call. */
function lastFetchUrl(fetchSpy: jest.Mock): string {
  const call = fetchSpy.mock.calls.at(-1);
  return call ? String(call[0]) : "";
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockReset();
});

// ── 1. initial render ─────────────────────────────────────────────────────────

describe("initial render", () => {
  it("calls fetch with no filter params and shows the loading indicator", async () => {
    // Hold the fetch promise so we can observe the loading state before resolution.
    let resolve!: (v: { ok: boolean; status: number; json: () => Promise<ResponsePayload> }) => void;
    const fetchSpy = jest.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<AdminPage />);

    expect(screen.getByText("載入中...")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(lastFetchUrl(fetchSpy)).toBe("/api/admin/npm?");

    await act(async () => {
      resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ works: [], statusCounts: {}, categoryCounts: {}, total: 0 }),
      });
    });
  });
});

// ── 2. empty state ────────────────────────────────────────────────────────────

describe("empty state", () => {
  it("renders the pipeline ingest hint when works is empty", async () => {
    mockFetchOk({ works: [], statusCounts: {}, categoryCounts: {}, total: 0 });
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText("尚無作品")).toBeInTheDocument());
    // The hint mentions the ingest command
    expect(screen.getByText(/python pipeline\/ingest\.py/)).toBeInTheDocument();
  });
});

// ── 3. filter wiring ──────────────────────────────────────────────────────────

describe("filter wiring", () => {
  async function setup() {
    const fetchSpy = mockFetchOk({
      works: [makeWork()],
      statusCounts: { pending: 1, done: 0 },
      categoryCounts: { 法書: 1, 法帖: 0, 拓片: 0 },
      total: 1,
    });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText("蘭亭序")).toBeInTheDocument());
    return fetchSpy;
  }

  it("clicking a status tab adds ?status=<value> to the fetch URL", async () => {
    const fetchSpy = await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^完成 \(/ }));
    });
    await waitFor(() => {
      expect(lastFetchUrl(fetchSpy)).toContain("status=done");
    });
  });

  it("clicking a category button adds ?category=<value> to the fetch URL", async () => {
    const fetchSpy = await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^法帖 \(/ }));
    });
    await waitFor(() => {
      const url = lastFetchUrl(fetchSpy);
      // URLSearchParams percent-encodes Chinese characters
      expect(url).toContain(`category=${encodeURIComponent("法帖")}`);
    });
  });

  it("typing in the search box adds ?q=<query> to the fetch URL (debounced 300ms)", async () => {
    const fetchSpy = await setup();
    await userEvent.type(screen.getByPlaceholderText(/搜尋名稱/), "王羲之");
    // Debounce is 300ms — waitFor's default 1000ms timeout covers it.
    await waitFor(
      () => {
        expect(lastFetchUrl(fetchSpy)).toContain(`q=${encodeURIComponent("王羲之")}`);
      },
      { timeout: 2000 }
    );
  });

  it("combines status, category, and search params together", async () => {
    const fetchSpy = await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^完成 \(/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^法書 \(/ }));
    });
    await userEvent.type(screen.getByPlaceholderText(/搜尋名稱/), "蘭亭");

    await waitFor(
      () => {
        const url = lastFetchUrl(fetchSpy);
        expect(url).toContain("status=done");
        expect(url).toContain(`category=${encodeURIComponent("法書")}`);
        expect(url).toContain(`q=${encodeURIComponent("蘭亭")}`);
      },
      { timeout: 2000 }
    );
  });
});

// ── 4. row click ──────────────────────────────────────────────────────────────

describe("row click navigation", () => {
  it("navigates to the annotate page with the encoded identifier", async () => {
    const tricky = "npm 001/special?id=test"; // forces encoding
    mockFetchOk({
      works: [makeWork({ identifier: tricky, name: "Tricky Work" })],
      statusCounts: { pending: 1 },
      categoryCounts: { 法書: 1 },
      total: 1,
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByText("Tricky Work"));

    await act(async () => {
      fireEvent.click(screen.getByText("Tricky Work"));
    });

    expect(mockPush).toHaveBeenCalledWith(
      `/admin/annotate?id=${encodeURIComponent(tricky)}`
    );
  });

  it("header back button navigates to /", async () => {
    mockFetchOk({ works: [], statusCounts: {}, categoryCounts: {}, total: 0 });
    render(<AdminPage />);
    await waitFor(() => screen.getByText("尚無作品"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /返回首頁/ }));
    });

    expect(mockPush).toHaveBeenCalledWith("/");
  });
});

// ── 5. status badges ──────────────────────────────────────────────────────────

describe("status badge labels", () => {
  const cases: Array<[Work["status"], string]> = [
    ["pending", "待處理"],
    ["processing", "已分析"],
    ["annotating", "標注中"],
    ["done", "完成"],
    ["skipped", "略過"],
  ];

  it.each(cases)("renders the correct label for status=%s", async (status, label) => {
    mockFetchOk({
      works: [makeWork({ identifier: `id-${status}`, name: `Work ${status}`, status })],
      statusCounts: { [status]: 1 },
      categoryCounts: { 法書: 1 },
      total: 1,
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByText(`Work ${status}`));

    // The row contains a status badge with this label. The status filter tab
    // also contains the label, so we assert at least one occurrence.
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });
});

// ── 6. shiwen indicator ───────────────────────────────────────────────────────

describe("shiwen indicator", () => {
  it("shows 釋文 ✓ when shiwen is non-empty", async () => {
    mockFetchOk({
      works: [makeWork({ shiwen: "永和九年" })],
      statusCounts: { pending: 1 },
      categoryCounts: { 法書: 1 },
      total: 1,
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByText(/釋文 ✓/));
    expect(screen.queryByText(/釋文 ✗/)).not.toBeInTheDocument();
  });

  it("shows 釋文 ✗ when shiwen is null", async () => {
    mockFetchOk({
      works: [makeWork({ shiwen: null })],
      statusCounts: { pending: 1 },
      categoryCounts: { 法書: 1 },
      total: 1,
    });
    render(<AdminPage />);
    await waitFor(() => screen.getByText(/釋文 ✗/));
    expect(screen.queryByText(/釋文 ✓/)).not.toBeInTheDocument();
  });
});

// ── 7. fetch error ────────────────────────────────────────────────────────────

describe("fetch failure", () => {
  it("shows an error message and hides the loading spinner when fetch rejects", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError("network down")) as unknown as typeof fetch;

    render(<AdminPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/載入失敗/);
    expect(screen.queryByText("載入中...")).not.toBeInTheDocument();
  });

  it("shows an error message when response is not ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;

    render(<AdminPage />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/載入失敗/);
  });
});
