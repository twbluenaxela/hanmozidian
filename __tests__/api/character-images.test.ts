/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/db/queries", () => ({
  getCharacterByChar: jest.fn(),
  getImages: jest.fn(),
  getStyleCounts: jest.fn(),
}));

jest.mock("@/lib/utils", () => ({
  resolveImageUrl: (p: string) => `/resolved/${p}`,
  parseIdList: jest.requireActual("@/lib/utils").parseIdList,
}));

import { GET } from "@/app/api/character/[char]/images/route";
import { getCharacterByChar, getImages, getStyleCounts } from "@/lib/db/queries";

const mockGetCharacterByChar = getCharacterByChar as jest.Mock;
const mockGetImages = getImages as jest.Mock;
const mockGetStyleCounts = getStyleCounts as jest.Mock;

function makeRequest(char: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/character/${encodeURIComponent(char)}/images`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function makeParams(char: string) {
  return Promise.resolve({ char: encodeURIComponent(char) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetStyleCounts.mockReturnValue([]);
  mockGetImages.mockReturnValue([]);
});

describe("GET /api/character/[char]/images", () => {
  it("returns 404 when character is not in the dictionary", async () => {
    mockGetCharacterByChar.mockReturnValue(null);
    const res = await GET(makeRequest("X"), { params: makeParams("X") });
    expect(res.status).toBe(404);
  });

  it("returns character, styleCounts, and images for a known character", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "永" });
    mockGetStyleCounts.mockReturnValue([{ slug: "kai", nameZh: "楷書", count: 5 }]);
    mockGetImages.mockReturnValue([{ id: 10, imagePath: "images/kai/10.png" }]);

    const res = await GET(makeRequest("永"), { params: makeParams("永") });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.character).toBe("永");
    expect(body.styleCounts).toHaveLength(1);
    expect(body.images[0].imageUrl).toBe("/resolved/images/kai/10.png");
  });

  it("passes style filter to getImages", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "永" });

    await GET(makeRequest("永", { style: "kai" }), { params: makeParams("永") });

    expect(mockGetImages).toHaveBeenCalledWith(
      expect.objectContaining({ styleSlug: "kai" })
    );
  });

  it("passes calligrapher filter ids to getImages", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "山" });

    await GET(makeRequest("山", { calligrapher: "3,7" }), { params: makeParams("山") });

    expect(mockGetImages).toHaveBeenCalledWith(
      expect.objectContaining({ calligrapherIds: [3, 7] })
    );
  });

  it("uses page 1 instead of NaN when page param is non-numeric", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "水" });

    await GET(makeRequest("水", { page: "abc" }), { params: makeParams("水") });

    expect(mockGetImages).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
  });

  it("uses default limit instead of NaN when limit param is non-numeric", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "火" });

    await GET(makeRequest("火", { limit: "xyz" }), { params: makeParams("火") });

    const call = mockGetImages.mock.calls[0][0];
    expect(Number.isFinite(call.limit)).toBe(true);
    expect(call.limit).toBeGreaterThanOrEqual(1);
  });

  it("ignores non-numeric values in id filter lists", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "木" });

    await GET(makeRequest("木", { calligrapher: "abc,5,NaN" }), { params: makeParams("木") });

    expect(mockGetImages).toHaveBeenCalledWith(
      expect.objectContaining({ calligrapherIds: [5] })
    );
  });
});
