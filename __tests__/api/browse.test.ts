/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/db/queries", () => ({
  getBrowseFilters: jest.fn(),
  getGalleryImages: jest.fn(),
  getGalleryImagesCorpusOrdered: jest.fn(),
  getWorkNameById: jest.fn(),
}));

jest.mock("@/lib/utils", () => ({
  resolveImageUrl: (p: string) => `/resolved/${p}`,
  parseIdList: jest.requireActual("@/lib/utils").parseIdList,
}));

// fs.readFileSync for corpus — return no-corpus by default
jest.mock("fs", () => ({ readFileSync: jest.fn(() => { throw new Error("no corpus"); }) }));

import { GET } from "@/app/api/browse/route";
import { getBrowseFilters, getGalleryImages, getGalleryImagesCorpusOrdered, getWorkNameById } from "@/lib/db/queries";

const mockGetBrowseFilters = getBrowseFilters as jest.Mock;
const mockGetGalleryImages = getGalleryImages as jest.Mock;
const mockGetGalleryImagesCorpusOrdered = getGalleryImagesCorpusOrdered as jest.Mock;
const mockGetWorkNameById = getWorkNameById as jest.Mock;

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/browse");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGalleryImages.mockReturnValue([]);
  mockGetGalleryImagesCorpusOrdered.mockReturnValue({ images: [], hasMore: false });
  mockGetWorkNameById.mockReturnValue(null);
});

describe("GET /api/browse — filters mode", () => {
  it("returns sidebar filter data when ?filters=1", async () => {
    mockGetBrowseFilters.mockReturnValue({
      calligraphers: [{ id: 1, nameZh: "王羲之", imageCount: 50 }],
      works: [],
    });

    const res = await GET(makeRequest({ filters: "1" }));
    const body = await res.json();

    expect(mockGetBrowseFilters).toHaveBeenCalledTimes(1);
    expect(body.calligraphers[0].nameZh).toBe("王羲之");
  });
});

describe("GET /api/browse — corpus-ordered mode", () => {
  beforeEach(() => {
    // Provide a minimal corpus so the route finds a matching piece
    const { readFileSync } = jest.requireMock("fs");
    readFileSync.mockReturnValue(
      JSON.stringify({ pieces: [{ id: "test", name_zh: "蘭亭集序", calligrapher_zh: null, text: "天下第一行書永" }] })
    );
    mockGetWorkNameById.mockReturnValue("蘭亭集序");
  });

  it("calls getGalleryImagesCorpusOrdered — not getGalleryImages", async () => {
    mockGetGalleryImagesCorpusOrdered.mockReturnValue({ images: [], hasMore: false });
    await GET(makeRequest({ work: "1" }));
    expect(mockGetGalleryImagesCorpusOrdered).toHaveBeenCalledTimes(1);
    expect(mockGetGalleryImages).not.toHaveBeenCalled();
  });

  it("passes the workId and charOrder derived from corpus text", async () => {
    mockGetGalleryImagesCorpusOrdered.mockReturnValue({ images: [], hasMore: false });
    await GET(makeRequest({ work: "7" }));
    const call = mockGetGalleryImagesCorpusOrdered.mock.calls[0][0];
    expect(call.workId).toBe(7);
    // "天下第一行書永" → unique CJK chars in order
    expect(call.charOrder).toEqual(["天", "下", "第", "一", "行", "書", "永"]);
  });

  it("returns corpusOrdered: true in response", async () => {
    mockGetGalleryImagesCorpusOrdered.mockReturnValue({
      images: [{ id: 1, imagePath: "images/x.png", character: "天" }],
      hasMore: false,
    });
    const res = await GET(makeRequest({ work: "1" }));
    const body = await res.json();
    expect(body.corpusOrdered).toBe(true);
  });

  it("resolves image URLs in corpus-ordered response", async () => {
    mockGetGalleryImagesCorpusOrdered.mockReturnValue({
      images: [{ id: 1, imagePath: "images/kai/1.png", character: "永" }],
      hasMore: false,
    });
    const res = await GET(makeRequest({ work: "1" }));
    const body = await res.json();
    expect(body.images[0].imageUrl).toBe("/resolved/images/kai/1.png");
  });

  it("passes hasMore from the query result through to response", async () => {
    mockGetGalleryImagesCorpusOrdered.mockReturnValue({ images: [], hasMore: true });
    const res = await GET(makeRequest({ work: "1" }));
    const body = await res.json();
    expect(body.hasMore).toBe(true);
  });

  it("falls back to default mode when no corpus piece matches the work", async () => {
    mockGetWorkNameById.mockReturnValue("無此碑帖");
    mockGetGalleryImages.mockReturnValue([]);
    await GET(makeRequest({ work: "99" }));
    expect(mockGetGalleryImages).toHaveBeenCalledTimes(1);
    expect(mockGetGalleryImagesCorpusOrdered).not.toHaveBeenCalled();
  });
});

describe("GET /api/browse — default paginated mode", () => {
  it("returns images with resolved URLs", async () => {
    mockGetGalleryImages.mockReturnValue([
      { id: 1, imagePath: "images/kai/1.png", character: "永" },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.images[0].imageUrl).toBe("/resolved/images/kai/1.png");
    expect(body.corpusOrdered).toBe(false);
  });

  it("sets hasMore=true when a full page is returned", async () => {
    // default limit is 20; return exactly 20 items
    mockGetGalleryImages.mockReturnValue(new Array(20).fill({ id: 1, imagePath: "x.png", character: "永" }));
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.hasMore).toBe(true);
  });

  it("sets hasMore=false when fewer than a full page is returned", async () => {
    mockGetGalleryImages.mockReturnValue([{ id: 1, imagePath: "x.png", character: "永" }]);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.hasMore).toBe(false);
  });

  it("clamps limit to max 50", async () => {
    await GET(makeRequest({ limit: "200" }));
    expect(mockGetGalleryImages).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    );
  });

  it("defaults page to 1 when page param is absent", async () => {
    await GET(makeRequest());
    expect(mockGetGalleryImages).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
  });

  it("uses page 1 instead of NaN when page param is non-numeric", async () => {
    await GET(makeRequest({ page: "abc" }));
    expect(mockGetGalleryImages).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
  });

  it("uses default limit instead of NaN when limit param is non-numeric", async () => {
    await GET(makeRequest({ limit: "xyz" }));
    const call = mockGetGalleryImages.mock.calls[0][0];
    expect(Number.isFinite(call.limit)).toBe(true);
    expect(call.limit).toBeGreaterThanOrEqual(1);
  });
});
