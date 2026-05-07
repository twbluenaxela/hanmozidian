/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/db/queries", () => ({
  getCharacterByChar: jest.fn(),
  getStyleCounts: jest.fn(),
}));

import { GET } from "@/app/api/search/route";
import { getCharacterByChar, getStyleCounts } from "@/lib/db/queries";

const mockGetCharacterByChar = getCharacterByChar as jest.Mock;
const mockGetStyleCounts = getStyleCounts as jest.Mock;

function makeRequest(q: string) {
  const url = new URL("http://localhost/api/search");
  if (q) url.searchParams.set("q", q);
  return new NextRequest(url);
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/search", () => {
  it("returns empty characters array when q is absent", async () => {
    const res = await GET(makeRequest(""));
    const body = await res.json();
    expect(body).toEqual({ characters: [] });
    expect(mockGetCharacterByChar).not.toHaveBeenCalled();
  });

  it("skips characters not found in the dictionary", async () => {
    mockGetCharacterByChar.mockReturnValue(null);
    const res = await GET(makeRequest("x"));
    const body = await res.json();
    expect(body.characters).toHaveLength(0);
  });

  it("returns a found character with style counts and totalImages", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "永", unicodeHex: "6C38" });
    mockGetStyleCounts.mockReturnValue([
      { slug: "kai", nameZh: "楷書", count: 10 },
      { slug: "xing", nameZh: "行書", count: 5 },
    ]);

    const res = await GET(makeRequest("永"));
    const body = await res.json();

    expect(body.characters).toHaveLength(1);
    expect(body.characters[0]).toMatchObject({
      character: "永",
      unicodeHex: "6C38",
      totalImages: 15,
    });
    expect(body.characters[0].styleCounts).toHaveLength(2);
  });

  it("calls getStyleCounts with the character's id", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 42, character: "山", unicodeHex: "5C71" });
    mockGetStyleCounts.mockReturnValue([]);

    await GET(makeRequest("山"));

    expect(mockGetStyleCounts).toHaveBeenCalledWith(42);
  });

  it("processes multiple characters in one request", async () => {
    mockGetCharacterByChar
      .mockReturnValueOnce({ id: 1, character: "天", unicodeHex: "5929" })
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ id: 3, character: "地", unicodeHex: "5730" });
    mockGetStyleCounts.mockReturnValue([{ slug: "kai", nameZh: "楷書", count: 3 }]);

    const res = await GET(makeRequest("天x地"));
    const body = await res.json();

    // "x" is not in DB and gets skipped
    expect(body.characters).toHaveLength(2);
    expect(body.characters[0].character).toBe("天");
    expect(body.characters[1].character).toBe("地");
  });

  it("totalImages sums all style counts correctly", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 7, character: "水", unicodeHex: "6C34" });
    mockGetStyleCounts.mockReturnValue([
      { slug: "kai", nameZh: "楷書", count: 20 },
      { slug: "xing", nameZh: "行書", count: 30 },
      { slug: "cao", nameZh: "草書", count: 50 },
    ]);

    const res = await GET(makeRequest("水"));
    const body = await res.json();

    expect(body.characters[0].totalImages).toBe(100);
  });

  it("converts simplified Chinese input to traditional before lookup", async () => {
    // 专 (simplified) → 專 (traditional); exact lookup fails, s2t fallback succeeds
    mockGetCharacterByChar
      .mockReturnValueOnce(null) // exact lookup for 专 fails
      .mockReturnValueOnce({ id: 99, character: "專", unicodeHex: "5C08" }); // s2t fallback
    mockGetStyleCounts.mockReturnValue([{ slug: "kai", nameZh: "楷書", count: 3 }]);

    const res = await GET(makeRequest("专"));
    const body = await res.json();

    expect(body.characters).toHaveLength(1);
    expect(mockGetCharacterByChar).toHaveBeenCalledWith("專");
  });

  it("converts a simplified multi-character query to traditional", async () => {
    // 专业 (simplified) → 專業 (traditional); exact lookups fail, s2t fallbacks succeed
    mockGetCharacterByChar
      .mockReturnValueOnce(null) // exact lookup for 专 fails
      .mockReturnValueOnce({ id: 99, character: "專", unicodeHex: "5C08" }) // s2t fallback for 专
      .mockReturnValueOnce(null) // exact lookup for 业 fails
      .mockReturnValueOnce({ id: 100, character: "業", unicodeHex: "696D" }); // s2t fallback for 业
    mockGetStyleCounts.mockReturnValue([]);

    const res = await GET(makeRequest("专业"));
    const body = await res.json();

    expect(mockGetCharacterByChar).toHaveBeenCalledWith("專");
    expect(mockGetCharacterByChar).toHaveBeenCalledWith("業");
    expect(body.characters).toHaveLength(2);
  });

  it("looks up a traditional-variant character exactly without converting it", async () => {
    // 裏 (U+88CF) is a traditional variant of 裡 (U+88E1); the app must NOT silently
    // convert 裏 to 裡 when 裏 exists in the DB
    mockGetCharacterByChar.mockReturnValueOnce({ id: 5, character: "裏", unicodeHex: "88CF" });
    mockGetStyleCounts.mockReturnValue([{ slug: "kai", nameZh: "楷書", count: 4 }]);

    const res = await GET(makeRequest("裏"));
    const body = await res.json();

    expect(body.characters).toHaveLength(1);
    expect(body.characters[0].character).toBe("裏");
    expect(mockGetCharacterByChar).toHaveBeenCalledTimes(1);
    expect(mockGetCharacterByChar).toHaveBeenCalledWith("裏");
  });
});
