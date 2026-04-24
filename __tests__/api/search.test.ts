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
});
