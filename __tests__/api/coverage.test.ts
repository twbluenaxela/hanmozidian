/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/db/queries", () => ({
  getCharacterByChar: jest.fn(),
  getJiziCoverage: jest.fn(),
}));

import { GET } from "@/app/api/jizi/coverage/route";
import { getCharacterByChar, getJiziCoverage } from "@/lib/db/queries";

const mockGetCharacterByChar = getCharacterByChar as jest.Mock;
const mockGetJiziCoverage = getJiziCoverage as jest.Mock;

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/jizi/coverage");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/jizi/coverage", () => {
  it("returns empty arrays when text is empty", async () => {
    const res = await GET(makeRequest({}));
    const body = await res.json();
    expect(body).toEqual({ characters: [], calligraphers: [], works: [] });
    expect(mockGetCharacterByChar).not.toHaveBeenCalled();
  });

  it("marks each character as found or not found", async () => {
    mockGetCharacterByChar
      .mockReturnValueOnce({ id: 1, character: "永" })
      .mockReturnValueOnce(null);
    mockGetJiziCoverage.mockReturnValue({ calligraphers: [], works: [] });

    const res = await GET(makeRequest({ text: "永x" }));
    const body = await res.json();

    expect(body.characters).toEqual([
      { char: "永", id: 1, found: true },
      { char: "x", id: null, found: false },
    ]);
  });

  it("passes only known character IDs to getJiziCoverage", async () => {
    mockGetCharacterByChar
      .mockReturnValueOnce({ id: 3, character: "天" })
      .mockReturnValueOnce(null);
    mockGetJiziCoverage.mockReturnValue({ calligraphers: [], works: [] });

    await GET(makeRequest({ text: "天x", style: "kai" }));

    expect(mockGetJiziCoverage).toHaveBeenCalledWith({
      characterIds: [3],
      styleSlug: "kai",
    });
  });

  it("passes style slug through to getJiziCoverage", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "水" });
    mockGetJiziCoverage.mockReturnValue({ calligraphers: [], works: [] });

    await GET(makeRequest({ text: "水", style: "zhuan" }));

    expect(mockGetJiziCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ styleSlug: "zhuan" })
    );
  });

  it("returns calligrapher and work facets in response", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "木" });
    mockGetJiziCoverage.mockReturnValue({
      calligraphers: [{ id: 2, nameZh: "顏真卿", imageCount: 10 }],
      works: [{ id: 4, nameZh: "多寶塔碑", imageCount: 10 }],
    });

    const res = await GET(makeRequest({ text: "木" }));
    const body = await res.json();

    expect(body.calligraphers[0]).toMatchObject({ nameZh: "顏真卿", imageCount: 10 });
    expect(body.works[0]).toMatchObject({ nameZh: "多寶塔碑", imageCount: 10 });
  });

  it("calls getJiziCoverage with no styleSlug when style param is absent", async () => {
    mockGetCharacterByChar.mockReturnValue({ id: 1, character: "山" });
    mockGetJiziCoverage.mockReturnValue({ calligraphers: [], works: [] });

    await GET(makeRequest({ text: "山" }));

    expect(mockGetJiziCoverage).toHaveBeenCalledWith({
      characterIds: [1],
      styleSlug: undefined,
    });
  });
});
