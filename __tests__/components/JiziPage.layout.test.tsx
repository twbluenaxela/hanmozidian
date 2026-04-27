/**
 * Layout-invariant tests for the 集字工坊 canvas.
 *
 * jsdom does not run a real layout engine, so pixel positions cannot be
 * measured. Instead these tests guard the CSS properties and DOM structure
 * that *guarantee* correct wrapping behaviour in a real browser:
 *
 *  - flex-wrap: wrap          → rows wrap; no single infinite row
 *  - display: inline-flex     → canvas shrinks to content, not viewport-width
 *  - max-width: 800px         → horizontal mode is width-bounded
 *  - overflow: auto           → scroll wrapper lets the user reach extra rows
 *  - height: auto             → horizontal canvas grows with content, not fixed
 *  - each cell has fixed px   → predictable tile size, no unbounded growth
 *  - shrink-0 on every cell   → cells never compress below their defined size
 *  - all N cells rendered     → no character is silently dropped from the DOM
 */

import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import JiziPage from "@/app/jizi/page";

jest.mock("html-to-image", () => ({ toPng: jest.fn() }));

// ── Mock Firebase so tests run without real credentials ──────────────────────
jest.mock("@/lib/firebase", () => ({ auth: {}, db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(), setDoc: jest.fn(), deleteDoc: jest.fn(),
  onSnapshot: jest.fn(() => () => {}), collection: jest.fn(),
  serverTimestamp: jest.fn(), getDocs: jest.fn(), query: jest.fn(), orderBy: jest.fn(),
}));
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: null, loading: false }) }));

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCharResult(char: string, id: number) {
  return {
    character: char,
    found: true,
    images: [{ id, imageUrl: `/images/${id}.png` }],
  };
}

/** Build an API mock that returns `count` character results. */
function makeFetch(results: object[]) {
  return jest.fn().mockImplementation((url: string) => {
    if (url.includes("/api/jizi/coverage")) {
      return Promise.resolve({
        json: () => Promise.resolve({ calligraphers: [], works: [] }),
      });
    }
    return Promise.resolve({ json: () => Promise.resolve({ characters: results }) });
  });
}

// Common CJK characters used to fill the canvas in tests
const CJK =
  "天地玄黃宇宙洪荒日月盈昃辰宿列張寒來暑往秋收冬藏閏餘成歲律呂調陽雲騰致雨露結為霜金生麗水玉出崑岡劍號巨闕珠稱夜光";

async function renderWithNChars(n: number) {
  const chars = [...CJK].slice(0, n);
  const results = chars.map((c, i) => makeCharResult(c, i + 1));
  global.fetch = makeFetch(results);

  render(<JiziPage />);

  const textarea = screen.getByPlaceholderText("輸入漢字...");
  fireEvent.change(textarea, { target: { value: chars.join("") } });

  await act(async () => { jest.advanceTimersByTime(400); });
  await waitFor(() =>
    expect(screen.getAllByTestId("char-cell")).toHaveLength(n)
  );
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

// ── canvas flex properties ────────────────────────────────────────────────────

describe("canvas flex layout (horizontal mode)", () => {
  it("uses inline-flex so the paper shrinks to content width", async () => {
    await renderWithNChars(10);
    const canvas = screen.getByTestId("jizi-canvas");
    expect(canvas).toHaveStyle({ display: "inline-flex" });
  });

  it("has flex-wrap: wrap so rows wrap instead of forming one long row", async () => {
    await renderWithNChars(10);
    const canvas = screen.getByTestId("jizi-canvas");
    expect(canvas).toHaveStyle({ flexWrap: "wrap" });
  });

  it("is bounded by max-width: 800px so it cannot grow wider than the layout column", async () => {
    await renderWithNChars(10);
    const canvas = screen.getByTestId("jizi-canvas");
    expect(canvas).toHaveStyle({ maxWidth: "800px" });
  });

  it("has height: auto so it grows downward with content and is not clipped", async () => {
    await renderWithNChars(10);
    const canvas = screen.getByTestId("jizi-canvas");
    expect(canvas).toHaveStyle({ height: "auto" });
  });

  it("has align-content: flex-start so wrapped rows pack to the top", async () => {
    await renderWithNChars(10);
    const canvas = screen.getByTestId("jizi-canvas");
    expect(canvas).toHaveStyle({ alignContent: "flex-start" });
  });
});

// ── scroll wrapper ────────────────────────────────────────────────────────────

describe("scroll wrapper", () => {
  it("has overflow-auto so extra rows are reachable by scrolling", async () => {
    await renderWithNChars(10);
    const scroll = screen.getByTestId("jizi-scroll");
    expect(scroll.className).toContain("overflow-auto");
  });
});

// ── character cells ───────────────────────────────────────────────────────────

describe("character cells", () => {
  it("every cell has explicit fixed pixel dimensions (default gridSize = 120)", async () => {
    await renderWithNChars(10);
    screen.getAllByTestId("char-cell").forEach((cell) => {
      expect(cell).toHaveStyle({ width: "120px", height: "120px" });
    });
  });

  it("every cell has shrink-0 so cells never compress below their defined size", async () => {
    await renderWithNChars(10);
    screen.getAllByTestId("char-cell").forEach((cell) => {
      expect(cell.className).toContain("shrink-0");
    });
  });
});

// ── 50-character stress test ──────────────────────────────────────────────────

describe("50-character input", () => {
  it("renders all 50 cells — no character is dropped from the DOM", async () => {
    await renderWithNChars(50);
    expect(screen.getAllByTestId("char-cell")).toHaveLength(50);
  });

  it("canvas still has flex-wrap: wrap with 50 characters", async () => {
    await renderWithNChars(50);
    expect(screen.getByTestId("jizi-canvas")).toHaveStyle({ flexWrap: "wrap" });
  });

  it("canvas is still bounded by max-width: 800px with 50 characters", async () => {
    await renderWithNChars(50);
    expect(screen.getByTestId("jizi-canvas")).toHaveStyle({ maxWidth: "800px" });
  });

  it("all 50 cells retain their fixed dimensions", async () => {
    await renderWithNChars(50);
    screen.getAllByTestId("char-cell").forEach((cell) => {
      expect(cell).toHaveStyle({ width: "120px", height: "120px" });
    });
  });

  it("all 50 cells keep shrink-0 so none are squeezed out of shape", async () => {
    await renderWithNChars(50);
    screen.getAllByTestId("char-cell").forEach((cell) => {
      expect(cell.className).toContain("shrink-0");
    });
  });

  it("scroll wrapper is still overflow-auto with 50 characters", async () => {
    await renderWithNChars(50);
    expect(screen.getByTestId("jizi-scroll").className).toContain("overflow-auto");
  });
});

// ── grid size slider changes cell dimensions ──────────────────────────────────

describe("grid size adjustment", () => {
  it("all cells update to the new gridSize when the 特大 button is clicked", async () => {
    await renderWithNChars(5);

    // Grid size is controlled by discrete buttons (小/中/大/特大).
    // 特大 sets gridSize to 200. Both sidebars render the button; click the first.
    const btns = screen.getAllByRole("button", { name: "特大" });
    fireEvent.click(btns[0]);

    await waitFor(() => {
      screen.getAllByTestId("char-cell").forEach((cell) => {
        expect(cell).toHaveStyle({ width: "200px", height: "200px" });
      });
    });
  });
});
