/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

// Mock the DB layer so tests never touch SQLite
jest.mock("@/lib/db/queries", () => ({
  getCharacterByChar: jest.fn(),
  getImages: jest.fn(),
  getJiziCoverage: jest.fn(),
}));

jest.mock("@/lib/utils", () => ({
  resolveImageUrl: (p: string) => `/resolved/${p}`,
  parseIdList: jest.requireActual("@/lib/utils").parseIdList,
}));

import { GET } from "@/app/api/jizi/route";
import {
  getCharacterByChar,
  getImages,
  getJiziCoverage,
} from "@/lib/db/queries";

const mockGetCharacterByChar = getCharacterByChar as jest.Mock;
const mockGetImages = getImages as jest.Mock;
const mockGetJiziCoverage = getJiziCoverage as jest.Mock;

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/jizi");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetJiziCoverage.mockReturnValue({ calligraphers: [], works: [] });
});

describe("GET /api/jizi", () => {
  it("returns empty characters array when text is empty", async () => {
    const res = await GET(makeRequest({}));
    const body = await res.json();
    expect(body).toEqual({ characters: [], calligraphers: [], works: [] });
    expect(mockGetCharacterByChar).not.toHaveBeenCalled();
  });

  it("marks character as not found when not in DB", async () => {
    mockGetCharacterByChar.mockReturnValue(null);
    const res = await GET(makeRequest({ text: "龍", style: "kai" }));
    const body = await res.json();
    expect(body.characters).toHaveLength(1);
    expect(body.characters[0]).toMatchObject({
      character: "龍",
      found: false,
      images: [],
    });
  });

  it("returns images with resolved URLs for a known character", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "永" });
    mockGetImages.mockReturnValue([
      { id: 10, imagePath: "images/kai/10.png", calligrapherName: "王羲之", workName: "蘭亭集序" },
    ]);

    const res = await GET(makeRequest({ text: "永", style: "kai" }));
    const body = await res.json();

    expect(body.characters[0]).toMatchObject({
      character: "永",
      found: true,
    });
    expect(body.characters[0].images[0].imageUrl).toBe(
      "/resolved/images/kai/10.png"
    );
  });

  it("processes each character in a multi-character string independently", async () => {
    mockGetCharacterByChar
      .mockReturnValueOnce({ id: 1, character: "天" })
      .mockReturnValueOnce(null); // 地 not in DB
    mockGetImages.mockReturnValue([]);

    const res = await GET(makeRequest({ text: "天地" }));
    const body = await res.json();

    expect(body.characters).toHaveLength(2);
    expect(body.characters[0].character).toBe("天");
    expect(body.characters[0].found).toBe(true);
    expect(body.characters[1].character).toBe("地");
    expect(body.characters[1].found).toBe(false);
  });

  it("passes calligrapher filter IDs to getImages", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 5, character: "山" });
    mockGetImages.mockReturnValue([]);

    await GET(makeRequest({ text: "山", style: "kai", calligrapher: "3,7" }));

    expect(mockGetImages).toHaveBeenCalledWith(
      expect.objectContaining({ calligrapherIds: [3, 7] })
    );
  });

  it("passes work filter IDs to getImages", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 5, character: "水" });
    mockGetImages.mockReturnValue([]);

    await GET(makeRequest({ text: "水", style: "kai", work: "12" }));

    expect(mockGetImages).toHaveBeenCalledWith(
      expect.objectContaining({ workIds: [12] })
    );
  });

  it("ignores non-numeric values in id lists", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 5, character: "火" });
    mockGetImages.mockReturnValue([]);

    await GET(makeRequest({ text: "火", calligrapher: "abc,5,NaN" }));

    expect(mockGetImages).toHaveBeenCalledWith(
      expect.objectContaining({ calligrapherIds: [5] })
    );
  });

  it("returns calligrapher and work facets from getJiziCoverage", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 2, character: "木" });
    mockGetImages.mockReturnValue([]);
    mockGetJiziCoverage.mockReturnValue({
      calligraphers: [{ id: 1, nameZh: "歐陽詢", imageCount: 5 }],
      works: [{ id: 3, nameZh: "九成宮", imageCount: 5 }],
    });

    const res = await GET(makeRequest({ text: "木", style: "kai" }));
    const body = await res.json();

    expect(body.calligraphers).toHaveLength(1);
    expect(body.calligraphers[0].nameZh).toBe("歐陽詢");
    expect(body.works[0].nameZh).toBe("九成宮");
  });
});
