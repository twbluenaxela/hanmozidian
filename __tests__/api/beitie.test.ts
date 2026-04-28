/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/db/beitie-queries", () => ({
  listBeitie: jest.fn(),
  getBeitieById: jest.fn(),
  saveAiSummary: jest.fn(),
}));

import { GET as listGET } from "@/app/api/beitie/route";
import { GET as detailGET } from "@/app/api/beitie/[id]/route";
import { listBeitie, getBeitieById } from "@/lib/db/beitie-queries";

const mockListBeitie = listBeitie as jest.Mock;
const mockGetBeitieById = getBeitieById as jest.Mock;

const SAMPLE_ITEM = {
  id: 1,
  title: "蘭亭集序",
  author: "王羲之",
  dynasty: "東晉",
  style: "行書",
  styleSlug: "xing",
  yearLabel: "353年",
  medium: null,
  charCount: null,
  summary: "天下第一行書",
  tags: ["天下第一行書"],
  coverImage: null,
  pages: [],
  shiwen: null,
  sourceCredit: null,
  sourceUrl: null,
  aiHistory: null,
  aiBiography: null,
  aiStyle: null,
  aiInfluence: null,
  aiStories: null,
  aiPractice: null,
  aiGeneratedAt: null,
};

function makeListRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/beitie");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function makeDetailRequest(id: string) {
  return new NextRequest(new URL(`http://localhost/api/beitie/${id}`));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListBeitie.mockReturnValue([]);
});

// ── GET /api/beitie ──────────────────────────────────────────────────────────

describe("GET /api/beitie", () => {
  it("returns an items array", async () => {
    mockListBeitie.mockReturnValue([SAMPLE_ITEM]);
    const res = await listGET(makeListRequest());
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("蘭亭集序");
  });

  it("returns empty items array when no beitie exist", async () => {
    const res = await listGET(makeListRequest());
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("passes style filter to listBeitie", async () => {
    await listGET(makeListRequest({ style: "kai" }));
    expect(mockListBeitie).toHaveBeenCalledWith("kai");
  });

  it("calls listBeitie with undefined when no style param", async () => {
    await listGET(makeListRequest());
    expect(mockListBeitie).toHaveBeenCalledWith(undefined);
  });

  it("returns 200", async () => {
    const res = await listGET(makeListRequest());
    expect(res.status).toBe(200);
  });
});

// ── GET /api/beitie/[id] ─────────────────────────────────────────────────────

describe("GET /api/beitie/[id]", () => {
  it("returns the item when found", async () => {
    mockGetBeitieById.mockReturnValue(SAMPLE_ITEM);
    const res = await detailGET(makeDetailRequest("1"), {
      params: Promise.resolve({ id: "1" }),
    });
    const body = await res.json();
    expect(body.item.title).toBe("蘭亭集序");
    expect(res.status).toBe(200);
  });

  it("returns 404 when item not found", async () => {
    mockGetBeitieById.mockReturnValue(null);
    const res = await detailGET(makeDetailRequest("99"), {
      params: Promise.resolve({ id: "99" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await detailGET(makeDetailRequest("abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(400);
  });

  it("passes the parsed integer id to getBeitieById", async () => {
    mockGetBeitieById.mockReturnValue(SAMPLE_ITEM);
    await detailGET(makeDetailRequest("7"), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(mockGetBeitieById).toHaveBeenCalledWith(7);
  });
});
