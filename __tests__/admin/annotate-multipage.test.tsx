/**
 * Tests for multi-page annotation features and recent bug fixes:
 *
 *  1. Box draw-order preservation — characters must follow insertion order,
 *     not spatial (y,x) order. (Prove-It for ordering bug)
 *  2. Multi-page: pageCount from API drives page navigation visibility
 *  3. Draft migration — old boxes without a page field default to page 0
 *  4. Delete key removes the selected box; ignored when an input is focused
 *  5. Canvas background click deselects the active box
 */

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import AnnotatePage from "@/app/admin/annotate/page";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: (k: string) => (k === "id" ? "test-id" : null) }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWork(overrides: Record<string, unknown> = {}) {
  return {
    identifier: "test-id",
    name: "Test Work",
    category: "法書",
    calligrapher: null,
    era: "唐",
    styleSlug: null,
    shiwen: "永樂",
    status: "annotating",
    annotationDraft: null,
    ...overrides,
  };
}

interface Draft {
  boxes: object[];
  shiwenChars: string[];
  imageSize: { w: number; h: number };
}

interface ResponseOptions {
  pageCount?: number;
  draft?: Draft;
  extraWorkFields?: Record<string, unknown>;
}

function makeResponse({ pageCount = 1, draft, extraWorkFields = {} }: ResponseOptions = {}) {
  const work = makeWork({
    annotationDraft: draft ? JSON.stringify(draft) : null,
    shiwen: draft ? draft.shiwenChars.join("") : "永樂",
    ...extraWorkFields,
  });
  return { work, boxes: null, pageCount };
}

function mockFetch(response: object) {
  const patchSpy = jest.fn();
  global.fetch = jest.fn().mockImplementation((_url: string, opts?: RequestInit) => {
    if (opts?.method === "PATCH") {
      patchSpy(JSON.parse(opts.body as string));
      return Promise.resolve({ json: () => Promise.resolve({}) });
    }
    return Promise.resolve({ json: () => Promise.resolve(response) });
  });
  return patchSpy;
}

async function setup(response: object = makeResponse()) {
  mockFetch(response);
  render(<AnnotatePage />);
  await waitFor(() => screen.getAllByText("Test Work"));
}

function getCanvas(): HTMLElement {
  return document.querySelector("[class*='relative'][class*='inline-block']") as HTMLElement;
}

function mockCanvasRect(canvas: HTMLElement) {
  jest.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, right: 800, bottom: 1200,
    width: 800, height: 1200, x: 0, y: 0, toJSON: () => {},
  });
}

async function drawBox(canvas: HTMLElement, x1: number, y1: number, x2: number, y2: number) {
  await act(async () => { fireEvent.mouseDown(canvas, { clientX: x1, clientY: y1 }); });
  await act(async () => { fireEvent.mouseUp(canvas, { clientX: x2, clientY: y2 }); });
}

/** Find character label spans (format: "N char" or "N ?") */
function getLabelTexts(): string[] {
  return Array.from(document.querySelectorAll("span"))
    .map(s => s.textContent?.trim() ?? "")
    .filter(t => /^\d+\s/.test(t));
}

/** Select a box by clicking it (onClick sets selectedId). */
async function selectBoxByLabel(labelRegex: RegExp) {
  const span = screen.getByText(labelRegex);
  const boxDiv = span.parentElement!;
  await act(async () => { fireEvent.click(boxDiv); });
  // Verify the delete button appeared (proves selection worked)
  await waitFor(() => expect(screen.getByText(/刪除選取框/)).toBeInTheDocument());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockReset();
});

// ── 1. Box draw-order preservation (Prove-It) ─────────────────────────────────

describe("draw-order preservation – characters follow insertion order, not y position", () => {
  /**
   * PROVE-IT: Two boxes at y=50 and y=60 have chars "永" and "樂".
   * Draw a third box at y=10 (above both). Old code sorted by y → new box
   * stole "永", shifting all assignments. Fixed code sorts by page only.
   */
  it("BUG: new box drawn at smaller y must NOT steal the first character", async () => {
    const draft: Draft = {
      boxes: [
        { id: "box-a", x: 10, y: 50, w: 40, h: 40, confidence: 0.9, source: "paddle", char: "永", page: 0 },
        { id: "box-b", x: 10, y: 60, w: 40, h: 40, confidence: 0.9, source: "paddle", char: "樂", page: 0 },
      ],
      shiwenChars: ["永", "樂"],
      imageSize: { w: 500, h: 800 },
    };
    await setup(makeResponse({ draft }));

    // Baseline: original labels intact
    expect(getLabelTexts()).toContain("1 永");
    expect(getLabelTexts()).toContain("2 樂");

    // Enable draw mode and draw a box ABOVE the existing ones (y=10)
    await act(async () => { fireEvent.click(screen.getByText("繪製新框")); });
    const canvas = getCanvas();
    mockCanvasRect(canvas);
    await drawBox(canvas, 100, 10, 160, 45);

    // After fix: original boxes keep their chars; new box (3rd in draw order) gets "?"
    const labels = getLabelTexts();
    expect(labels).toContain("1 永"); // box-a keeps "永"
    expect(labels).toContain("2 樂"); // box-b keeps "樂"
    expect(labels).toContain("3 ?"); // new box has no char (shiwenChars only has 2)
  });

  it("assigns chars in draw order regardless of spatial position", async () => {
    // Pre-populate shiwenChars via a draft so the state is set before drawing.
    // (Loading from work.shiwen only sets shiwenInput, not shiwenChars state.)
    const draft: Draft = {
      boxes: [],
      shiwenChars: ["永", "樂", "大", "帝"],
      imageSize: { w: 500, h: 800 },
    };
    await setup(makeResponse({ draft }));

    await act(async () => { fireEvent.click(screen.getByText("繪製新框")); });
    const canvas = getCanvas();
    mockCanvasRect(canvas);

    // Draw 4 boxes: first at y=80, then y=10, y=50, y=30 (spatially out of order)
    await drawBox(canvas, 0, 80, 40, 120);  // draw order 1 → "永"
    await drawBox(canvas, 0, 10, 40, 50);   // draw order 2 → "樂"
    await drawBox(canvas, 0, 50, 40, 75);   // draw order 3 → "大"
    await drawBox(canvas, 0, 30, 40, 45);   // draw order 4 → "帝"

    const labels = getLabelTexts();
    expect(labels).toContain("1 永");
    expect(labels).toContain("2 樂");
    expect(labels).toContain("3 大");
    expect(labels).toContain("4 帝");
  });
});

// ── 2. Multi-page navigation ──────────────────────────────────────────────────

describe("page navigation", () => {
  it("hides page nav when pageCount is 1", async () => {
    await setup(makeResponse({ pageCount: 1 }));
    expect(screen.queryByText(/頁 \d+ \/ \d+/)).not.toBeInTheDocument();
  });

  it("shows page nav when pageCount > 1", async () => {
    await setup(makeResponse({ pageCount: 12 }));
    expect(screen.getByText("頁 1 / 12")).toBeInTheDocument();
  });

  it("prev button is disabled on page 1", async () => {
    await setup(makeResponse({ pageCount: 5 }));
    const indicator = screen.getByText("頁 1 / 5");
    const nav = indicator.parentElement!;
    const buttons = nav.querySelectorAll("button");
    expect(buttons[0]).toBeDisabled();
  });

  it("next button is disabled on last page", async () => {
    await setup(makeResponse({ pageCount: 2 }));
    const getNav = () => screen.getByText(/頁 \d+ \/ 2/).parentElement!;
    const nextBtn = () => Array.from(getNav().querySelectorAll("button")).at(-1)!;

    expect(nextBtn()).not.toBeDisabled();
    await act(async () => { fireEvent.click(nextBtn()); });
    expect(screen.getByText("頁 2 / 2")).toBeInTheDocument();
    expect(nextBtn()).toBeDisabled();
  });

  it("navigates forward and backward through pages", async () => {
    await setup(makeResponse({ pageCount: 5 }));

    const getNav = () => screen.getByText(/頁 \d+ \/ 5/).parentElement!;
    const nextBtn = () => Array.from(getNav().querySelectorAll("button")).at(-1)!;
    const prevBtn = () => getNav().querySelectorAll("button")[0];

    await act(async () => { fireEvent.click(nextBtn()); });
    expect(screen.getByText("頁 2 / 5")).toBeInTheDocument();

    await act(async () => { fireEvent.click(nextBtn()); });
    expect(screen.getByText("頁 3 / 5")).toBeInTheDocument();

    await act(async () => { fireEvent.click(prevBtn()); });
    expect(screen.getByText("頁 2 / 5")).toBeInTheDocument();
  });
});

// ── 3. Draft migration ────────────────────────────────────────────────────────

describe("draft migration – boxes from old single-page drafts get page=0", () => {
  it("renders boxes from an old draft (no page field) on page 1", async () => {
    const draft: Draft = {
      boxes: [
        // Old format: no page field
        { id: "box-old", x: 10, y: 10, w: 40, h: 40, confidence: 0.9, source: "paddle", char: "永" },
      ],
      shiwenChars: ["永"],
      imageSize: { w: 500, h: 800 },
    };
    await setup(makeResponse({ pageCount: 3, draft }));

    // currentPage=0: migrated box (page=0) should be visible
    expect(getLabelTexts()).toContain("1 永");
  });

  it("old-draft boxes do NOT appear on page 2", async () => {
    const draft: Draft = {
      boxes: [
        { id: "box-old", x: 10, y: 10, w: 40, h: 40, confidence: 0.9, source: "paddle", char: "永" },
      ],
      shiwenChars: ["永"],
      imageSize: { w: 500, h: 800 },
    };
    await setup(makeResponse({ pageCount: 3, draft }));

    const nextBtn = () => {
      const indicator = screen.getByText(/頁 \d+ \/ 3/);
      return Array.from(indicator.parentElement!.querySelectorAll("button")).at(-1)!;
    };
    await act(async () => { fireEvent.click(nextBtn()); });
    expect(screen.getByText("頁 2 / 3")).toBeInTheDocument();

    // Box migrated to page 0 must not appear on page 1 (index 1)
    expect(getLabelTexts()).not.toContain("1 永");
  });
});

// ── 4. Delete key shortcut ────────────────────────────────────────────────────

describe("delete key shortcut", () => {
  function makeTwoBoxDraft(): Draft {
    return {
      boxes: [
        { id: "box-a", x: 10, y: 10, w: 40, h: 40, confidence: 0.9, source: "paddle", char: "永", page: 0 },
        { id: "box-b", x: 60, y: 10, w: 40, h: 40, confidence: 0.9, source: "paddle", char: "樂", page: 0 },
      ],
      shiwenChars: ["永", "樂"],
      imageSize: { w: 500, h: 800 },
    };
  }

  it("removes the selected box when Delete is pressed", async () => {
    await setup(makeResponse({ draft: makeTwoBoxDraft() }));
    expect(getLabelTexts()).toContain("1 永");
    expect(getLabelTexts()).toContain("2 樂");

    await selectBoxByLabel(/1 永/);

    await act(async () => { fireEvent.keyDown(window, { key: "Delete" }); });

    // box-a gone → only 1 label remains; box-b shifts to index 0 and gets shiwenChars[0]="永"
    expect(getLabelTexts()).toHaveLength(1);
    expect(getLabelTexts()).not.toContain("2 樂"); // no longer at index 1
  });

  it("removes the selected box when Backspace is pressed", async () => {
    await setup(makeResponse({ draft: makeTwoBoxDraft() }));
    await selectBoxByLabel(/2 樂/);

    await act(async () => { fireEvent.keyDown(window, { key: "Backspace" }); });

    // box-b gone → only box-a remains at index 0 with char "永" (unchanged)
    expect(getLabelTexts()).toHaveLength(1);
    expect(getLabelTexts()).toContain("1 永");
    expect(getLabelTexts()).not.toContain("2 樂");
  });

  it("does NOT delete when a text input is focused", async () => {
    await setup(makeResponse({ draft: makeTwoBoxDraft() }));
    await selectBoxByLabel(/1 永/);

    // Focus the shiwen textarea
    const textarea = screen.getByPlaceholderText("貼上釋文...");
    await act(async () => { textarea.focus(); });

    await act(async () => { fireEvent.keyDown(window, { key: "Delete" }); });

    // Box should still be there
    expect(getLabelTexts()).toContain("1 永");
  });

  it("does nothing when no box is selected", async () => {
    await setup(makeResponse({ draft: makeTwoBoxDraft() }));

    await act(async () => { fireEvent.keyDown(window, { key: "Delete" }); });

    expect(getLabelTexts()).toContain("1 永");
    expect(getLabelTexts()).toContain("2 樂");
  });
});

// ── 5. Canvas background click deselects ─────────────────────────────────────

describe("clicking canvas background clears selection", () => {
  const singleBoxDraft: Draft = {
    boxes: [
      { id: "box-a", x: 10, y: 10, w: 40, h: 40, confidence: 0.9, source: "paddle", char: "永", page: 0 },
    ],
    shiwenChars: ["永"],
    imageSize: { w: 500, h: 800 },
  };

  it("hides the delete button after clicking the canvas outside any box", async () => {
    await setup(makeResponse({ draft: singleBoxDraft }));

    await selectBoxByLabel(/1 永/);
    expect(screen.getByText(/刪除選取框/)).toBeInTheDocument();

    // Click the canvas background (not on any box, not in draw mode)
    const canvas = getCanvas();
    await act(async () => { fireEvent.mouseDown(canvas, { clientX: 400, clientY: 400 }); });

    expect(screen.queryByText(/刪除選取框/)).not.toBeInTheDocument();
  });

  it("does NOT deselect when draw mode is active (canvas click starts drawing)", async () => {
    await setup(makeResponse({ draft: singleBoxDraft }));

    // Select box first
    await selectBoxByLabel(/1 永/);
    // Enable draw mode
    await act(async () => { fireEvent.click(screen.getByText("繪製新框")); });

    // Click canvas in draw mode — should NOT deselect
    const canvas = getCanvas();
    mockCanvasRect(canvas);
    await act(async () => { fireEvent.mouseDown(canvas, { clientX: 300, clientY: 300 }); });

    // Delete button should still be present
    expect(screen.getByText(/刪除選取框/)).toBeInTheDocument();
  });
});
