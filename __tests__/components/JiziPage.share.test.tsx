/**
 * Tests for the 集字工坊 share / copy-to-clipboard button.
 *
 * Guards the following behaviours introduced when native share was replaced
 * with clipboard copy:
 *  - Clicking "分享" calls navigator.clipboard.write with a PNG blob
 *  - "已複製" toast appears after a successful copy
 *  - The toast disappears after 2 seconds
 *  - "不支援複製" toast appears when clipboard API is unavailable
 *  - navigator.share is NOT called (it was removed)
 */

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { toPng } from "html-to-image";
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

const MOCK_DATA_URL = "data:image/png;base64,abc123";
const MOCK_BLOB = new Blob(["png-bytes"], { type: "image/png" });

// Build a fetch mock that handles:
//   /api/jizi             → character results
//   /api/jizi/coverage    → empty facets
//   MOCK_DATA_URL         → blob (simulates fetch(dataUrl).blob())
function makeFetch() {
  return jest.fn().mockImplementation((url: string) => {
    if (url === MOCK_DATA_URL) {
      return Promise.resolve({ blob: () => Promise.resolve(MOCK_BLOB) });
    }
    if (url.includes("/api/jizi/coverage")) {
      return Promise.resolve({
        json: () => Promise.resolve({ calligraphers: [], works: [] }),
      });
    }
    return Promise.resolve({
      json: () =>
        Promise.resolve({
          characters: [
            { character: "永", found: true, images: [{ id: 1, imageUrl: "/images/1.png" }] },
          ],
        }),
    });
  });
}

// ClipboardItem is not defined in jsdom; provide a minimal stub.
if (typeof ClipboardItem === "undefined") {
  (global as any).ClipboardItem = class ClipboardItem {
    constructor(public data: Record<string, Blob>) {}
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  (toPng as jest.Mock).mockResolvedValue(MOCK_DATA_URL);
  global.fetch = makeFetch();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  delete (navigator as any).share;
  delete (navigator as any).clipboard;
});

// ── helpers ───────────────────────────────────────────────────────────────────

async function typeAndCompose(text: string) {
  const textarea = screen.getByPlaceholderText("輸入漢字...");
  fireEvent.change(textarea, { target: { value: text } });
  await act(async () => { jest.advanceTimersByTime(400); });
}

async function clickShare() {
  fireEvent.click(screen.getByRole("button", { name: /分享/ }));
  // Advance past the 300 ms pre-capture delay inside handleShare
  act(() => { jest.advanceTimersByTime(300); });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("JiziPage – share button (clipboard copy)", () => {
  it("calls navigator.clipboard.write with a PNG ClipboardItem", async () => {
    const writeMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { write: writeMock }, configurable: true,
    });

    render(<JiziPage />);
    await typeAndCompose("永");
    await waitFor(() => screen.getByAltText("永"));

    await clickShare();

    await waitFor(() => expect(writeMock).toHaveBeenCalledTimes(1));
    const [items] = writeMock.mock.calls[0];
    expect(items).toHaveLength(1);
    expect(items[0]).toBeInstanceOf(ClipboardItem);
  });

  it("shows '已複製' toast after successful clipboard write", async () => {
    const writeMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { write: writeMock }, configurable: true,
    });

    render(<JiziPage />);
    await typeAndCompose("永");
    await waitFor(() => screen.getByAltText("永"));

    await clickShare();

    await waitFor(() => expect(screen.getByText("已複製")).toBeInTheDocument());
  });

  it("toast disappears after 2 seconds", async () => {
    const writeMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { write: writeMock }, configurable: true,
    });

    render(<JiziPage />);
    await typeAndCompose("永");
    await waitFor(() => screen.getByAltText("永"));

    await clickShare();
    await waitFor(() => screen.getByText("已複製"));

    act(() => { jest.advanceTimersByTime(2000); });
    await waitFor(() => expect(screen.queryByText("已複製")).not.toBeInTheDocument());
  });

  it("shows '不支援複製' toast when clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {}, configurable: true,
    });

    render(<JiziPage />);
    await typeAndCompose("永");
    await waitFor(() => screen.getByAltText("永"));

    await clickShare();

    await waitFor(() => expect(screen.getByText("不支援複製")).toBeInTheDocument());
  });

  it("does not call navigator.share", async () => {
    const shareMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock, configurable: true,
    });
    const writeMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { write: writeMock }, configurable: true,
    });

    render(<JiziPage />);
    await typeAndCompose("永");
    await waitFor(() => screen.getByAltText("永"));

    await clickShare();

    await waitFor(() => expect(writeMock).toHaveBeenCalled());
    expect(shareMock).not.toHaveBeenCalled();
  });
});
