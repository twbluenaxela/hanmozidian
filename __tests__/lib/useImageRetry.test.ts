/**
 * Tests for the useImageRetry hook.
 *
 * Guards the following behaviours:
 *  - Normal load path: loading → loaded
 *  - Retry path:       first error → retry after 500 ms → loaded / failed
 *  - Session cache:    once a URL has loaded, a fresh hook instance for the
 *                      same URL starts as "loaded" (no skeleton, no re-fetch)
 *  - Cache key scope:  cors=1 and gallery=1 are independent cache entries
 *  - URL change:       changing imageUrl resets to "loading" even if the new
 *                      URL is already cached
 *  - Empty URL:        empty src, stays "loading"
 */

import { renderHook, act } from "@testing-library/react";
import { useImageRetry, clearImageCache } from "@/lib/useImageRetry";

beforeEach(() => {
  clearImageCache();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── helpers ───────────────────────────────────────────────────────────────────

const URL_A = "https://r2.example.com/images/a.webp";
const URL_B = "https://r2.example.com/images/b.webp";

// ── basic load path ───────────────────────────────────────────────────────────

describe("useImageRetry – normal load", () => {
  it("starts in loading status", () => {
    const { result } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    expect(result.current.status).toBe("loading");
  });

  it("builds src with the queryParam appended", () => {
    const { result } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    expect(result.current.src).toBe(`${URL_A}?cors=1`);
  });

  it("transitions to loaded when onLoad fires", () => {
    const { result } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    act(() => result.current.onLoad());
    expect(result.current.status).toBe("loaded");
  });

  it("src has no retry token on initial load", () => {
    const { result } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    expect(result.current.src).not.toContain("&r=");
  });
});

// ── retry path ────────────────────────────────────────────────────────────────

describe("useImageRetry – retry on error", () => {
  it("stays loading after first error (retry is pending)", () => {
    const { result } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    act(() => result.current.onError());
    expect(result.current.status).toBe("loading");
  });

  it("appends retry token to src after the 500 ms delay", () => {
    const { result } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    act(() => result.current.onError());
    act(() => jest.advanceTimersByTime(500));
    expect(result.current.src).toContain("&r=1");
  });

  it("marks as failed after two consecutive errors", () => {
    const { result } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    act(() => result.current.onError());
    act(() => jest.advanceTimersByTime(500));
    act(() => result.current.onError());
    expect(result.current.status).toBe("failed");
  });

  it("resets retry count when imageUrl changes", () => {
    const { result, rerender } = renderHook(
      ({ url }) => useImageRetry(url, "cors=1"),
      { initialProps: { url: URL_A } }
    );
    // Exhaust retries on URL_A
    act(() => result.current.onError());
    act(() => jest.advanceTimersByTime(500));
    act(() => result.current.onError());
    expect(result.current.status).toBe("failed");

    // Switch to URL_B — should reset
    rerender({ url: URL_B });
    expect(result.current.status).toBe("loading");

    // One error on URL_B should not immediately fail — retry is still available
    act(() => result.current.onError());
    expect(result.current.status).toBe("loading");
  });
});

// ── session cache ─────────────────────────────────────────────────────────────

describe("useImageRetry – session cache", () => {
  it("a second hook instance for a previously loaded URL starts as loaded", () => {
    // First instance loads successfully — populates the cache
    const { result: first } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    act(() => first.current.onLoad());
    expect(first.current.status).toBe("loaded");

    // Second instance for the same URL — should be immediately "loaded"
    const { result: second } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    expect(second.current.status).toBe("loaded");
  });

  it("cached instance src has no retry token", () => {
    const { result: first } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    act(() => first.current.onLoad());

    const { result: second } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    expect(second.current.src).toBe(`${URL_A}?cors=1`);
    expect(second.current.src).not.toContain("&r=");
  });

  it("changing imageUrl to a cached URL immediately shows loaded", () => {
    // Pre-load URL_B
    const { result: pre } = renderHook(() => useImageRetry(URL_B, "cors=1"));
    act(() => pre.current.onLoad());

    // Hook starts with URL_A (not cached) then switches to URL_B (cached)
    const { result, rerender } = renderHook(
      ({ url }) => useImageRetry(url, "cors=1"),
      { initialProps: { url: URL_A } }
    );
    expect(result.current.status).toBe("loading");

    rerender({ url: URL_B });
    expect(result.current.status).toBe("loaded");
  });

  it("cache is scoped to queryParam — cors=1 and gallery=1 are separate entries", () => {
    // Load URL_A with cors=1
    const { result: corsHook } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    act(() => corsHook.current.onLoad());

    // A hook for the same URL but gallery=1 should NOT be pre-loaded
    const { result: galleryHook } = renderHook(() =>
      useImageRetry(URL_A, "gallery=1")
    );
    expect(galleryHook.current.status).toBe("loading");
  });

  it("an uncached URL is not affected by cache hits for other URLs", () => {
    const { result: aHook } = renderHook(() => useImageRetry(URL_A, "cors=1"));
    act(() => aHook.current.onLoad());

    const { result: bHook } = renderHook(() => useImageRetry(URL_B, "cors=1"));
    expect(bHook.current.status).toBe("loading");
  });
});

// ── edge cases ────────────────────────────────────────────────────────────────

describe("useImageRetry – edge cases", () => {
  it("returns empty src for empty imageUrl", () => {
    const { result } = renderHook(() => useImageRetry("", "cors=1"));
    expect(result.current.src).toBe("");
  });

  it("remains in loading for empty imageUrl (nothing to load)", () => {
    const { result } = renderHook(() => useImageRetry("", "cors=1"));
    expect(result.current.status).toBe("loading");
  });

  it("handles imageUrls that already contain a query string", () => {
    const urlWithQuery = "https://r2.example.com/images/a.webp?v=2";
    const { result } = renderHook(() => useImageRetry(urlWithQuery, "cors=1"));
    // Should append with & not ?
    expect(result.current.src).toBe(`${urlWithQuery}&cors=1`);
    expect(result.current.src).not.toContain("??");
  });
});
