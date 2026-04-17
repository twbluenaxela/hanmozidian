/**
 * Integration tests for the 集字工坊 canvas image display and gallery
 * alternative-selection flow.
 *
 * These tests guard against regressions where:
 *  - a broken/empty <img> is rendered instead of the text fallback
 *  - clicking an alternative image in the sidebar fails to update the canvas
 *  - a stale selectedImageId causes a broken image after style changes
 */

import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import JiziPage from "@/app/jizi/page";

// ── Mock html-to-image (export feature, not under test) ─────────────────────
jest.mock("html-to-image", () => ({ toPng: jest.fn() }));

// ── Shared fixture data ──────────────────────────────────────────────────────
const IMAGE_1 = { id: 1, imageUrl: "/images/kai/1.png" };
const IMAGE_2 = { id: 2, imageUrl: "/images/kai/2.png" };
const IMAGE_3 = { id: 3, imageUrl: "/images/kai/3.png" };

const characterWithThreeImages = {
  character: "永",
  found: true,
  images: [IMAGE_1, IMAGE_2, IMAGE_3],
};

const characterNotFound = {
  character: "龘",
  found: false,
  images: [],
};

const characterFoundNoImages = {
  character: "靈",
  found: true,
  images: [],
};

function makeFetch(characters: object[]) {
  return jest.fn().mockImplementation((url: string) => {
    if (url.includes("/api/jizi/coverage")) {
      return Promise.resolve({
        json: () => Promise.resolve({ calligraphers: [], works: [] }),
      });
    }
    return Promise.resolve({
      json: () => Promise.resolve({ characters }),
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Type text into the textarea and flush the 400 ms debounce. */
async function typeAndCompose(text: string) {
  const textarea = screen.getByPlaceholderText("輸入漢字...");
  fireEvent.change(textarea, { target: { value: text } });
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
}

/** Click the nth character cell on the canvas (0-indexed). */
function clickCharCell(index: number) {
  const cells = screen.getAllByRole("img");
  // Each CalligraphyCharacter renders an <img alt={char}>; click its parent cell
  fireEvent.click(cells[index].closest("[data-testid]") ?? cells[index].parentElement!.parentElement!);
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe("JiziPage – image display", () => {
  it("shows a calligraphy image when the character is found and has images", async () => {
    global.fetch = makeFetch([characterWithThreeImages]);
    render(<JiziPage />);
    await typeAndCompose("永");

    await waitFor(() => {
      const img = screen.getByAltText("永");
      expect(img).toBeInTheDocument();
      expect(img.getAttribute("src")).toContain(IMAGE_1.imageUrl);
    });
  });

  it("shows the text fallback (not an img) when the character is not in the database", async () => {
    global.fetch = makeFetch([characterNotFound]);
    render(<JiziPage />);
    await typeAndCompose("龘");

    await waitFor(() => {
      // No <img alt="龘"> — a broken image must not be rendered
      expect(screen.queryByAltText("龘")).not.toBeInTheDocument();
      // The dashed fallback div in the canvas shows the glyph as text
      const matches = screen.getAllByText("龘"); // textarea + canvas fallback
      const canvasFallback = matches.find((el) => el.tagName === "DIV");
      expect(canvasFallback).toBeInTheDocument();
    });
  });

  it("shows the text fallback when the character is found but has no images", async () => {
    global.fetch = makeFetch([characterFoundNoImages]);
    render(<JiziPage />);
    await typeAndCompose("靈");

    await waitFor(() => {
      expect(screen.queryByAltText("靈")).not.toBeInTheDocument();
      const matches = screen.getAllByText("靈");
      const canvasFallback = matches.find((el) => el.tagName === "DIV");
      expect(canvasFallback).toBeInTheDocument();
    });
  });

  it("never renders an <img> with an empty or missing src", async () => {
    global.fetch = makeFetch([characterWithThreeImages, characterNotFound]);
    render(<JiziPage />);
    await typeAndCompose("永龘");

    await waitFor(() => screen.getByAltText("永"));

    const imgs = document.querySelectorAll("img");
    imgs.forEach((img) => {
      const src = img.getAttribute("src") ?? "";
      expect(src.length).toBeGreaterThan(0);
      // src must not be a bare slash or the literal string "undefined"
      expect(src).not.toBe("/");
      expect(src).not.toContain("undefined");
    });
  });
});

describe("JiziPage – gallery alternative selection", () => {
  async function renderAndSelectChar() {
    global.fetch = makeFetch([characterWithThreeImages]);
    render(<JiziPage />);
    await typeAndCompose("永");
    await waitFor(() => screen.getByAltText("永"));

    // Click the character cell to select it and open the sidebar
    const charImg = screen.getByAltText("永");
    fireEvent.click(charImg.closest('[class*="cursor-pointer"]')!);
  }

  it("opens the gallery in the sidebar when a character with multiple images is clicked", async () => {
    await renderAndSelectChar();
    await waitFor(() => {
      expect(screen.getByText("替換版本")).toBeInTheDocument();
    });
  });

  it("gallery shows one thumbnail per available image", async () => {
    await renderAndSelectChar();
    await waitFor(() => screen.getByText("替換版本"));

    const gallery = screen.getByText("替換版本").closest("div")!;
    const thumbnails = within(gallery).getAllByRole("img");
    expect(thumbnails).toHaveLength(3);
  });

  it("clicking an alternative updates the canvas to show that image", async () => {
    await renderAndSelectChar();
    await waitFor(() => screen.getByText("替換版本"));

    const gallery = screen.getByText("替換版本").closest("div")!;
    const thumbnails = within(gallery).getAllByRole("img");

    // Click the second alternative (IMAGE_2)
    fireEvent.click(thumbnails[1].closest("button")!);

    await waitFor(() => {
      const canvasImg = screen.getByAltText("永");
      expect(canvasImg.getAttribute("src")).toContain(IMAGE_2.imageUrl);
    });
  });

  it("clicking the third alternative updates the canvas to show that image", async () => {
    await renderAndSelectChar();
    await waitFor(() => screen.getByText("替換版本"));

    const gallery = screen.getByText("替換版本").closest("div")!;
    const thumbnails = within(gallery).getAllByRole("img");

    fireEvent.click(thumbnails[2].closest("button")!);

    await waitFor(() => {
      const canvasImg = screen.getByAltText("永");
      expect(canvasImg.getAttribute("src")).toContain(IMAGE_3.imageUrl);
    });
  });

  it("canvas still shows a valid image after a stale selectedImageId (simulates style switch)", async () => {
    // Start with 3 images, select image 3
    global.fetch = makeFetch([characterWithThreeImages]);
    render(<JiziPage />);
    await typeAndCompose("永");
    await waitFor(() => screen.getByAltText("永"));

    // Select character and pick alternative 3
    const charImg = screen.getByAltText("永");
    fireEvent.click(charImg.closest('[class*="cursor-pointer"]')!);
    await waitFor(() => screen.getByText("替換版本"));

    const gallery = screen.getByText("替換版本").closest("div")!;
    fireEvent.click(within(gallery).getAllByRole("img")[2].closest("button")!);
    await waitFor(() =>
      expect(screen.getByAltText("永").getAttribute("src")).toContain(IMAGE_3.imageUrl)
    );

    // Now simulate a style switch returning only 1 image (id 1) — IMAGE_3 is gone
    global.fetch = makeFetch([{ ...characterWithThreeImages, images: [IMAGE_1] }]);
    const styleBtn = screen.getByRole("button", { name: "行書" });
    fireEvent.click(styleBtn);
    await act(async () => { jest.advanceTimersByTime(400); });

    await waitFor(() => {
      const canvasImg = screen.getByAltText("永");
      const src = canvasImg.getAttribute("src") ?? "";
      // Must show a real image (IMAGE_1 fallback), not a broken src
      expect(src).toContain(IMAGE_1.imageUrl);
      expect(src).not.toContain("undefined");
    });
  });
});
