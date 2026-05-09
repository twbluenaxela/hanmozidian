/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/db/beitie-queries", () => ({
  listBeitie: jest.fn(),
  getBeitieById: jest.fn(),
  insertBeitie: jest.fn(),
  updateBeitie: jest.fn(),
  deleteBeitie: jest.fn(),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import { GET as adminListGET, POST as adminPOST } from "@/app/api/admin/beitie/route";
import { PATCH, DELETE } from "@/app/api/admin/beitie/[id]/route";
import { GET as npmLookupGET } from "@/app/api/admin/beitie/npm-lookup/route";
import {
  listBeitie,
  getBeitieById,
  insertBeitie,
  updateBeitie,
  deleteBeitie,
} from "@/lib/db/beitie-queries";
import { existsSync, readFileSync } from "fs";

const mockListBeitie = listBeitie as jest.Mock;
const mockGetBeitieById = getBeitieById as jest.Mock;
const mockInsertBeitie = insertBeitie as jest.Mock;
const mockUpdateBeitie = updateBeitie as jest.Mock;
const mockDeleteBeitie = deleteBeitie as jest.Mock;
const mockExistsSync = existsSync as jest.Mock;
const mockReadFileSync = readFileSync as jest.Mock;

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
  summary: null,
  tags: [],
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

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(`http://localhost${url}`), init);
}

function jsonBody(data: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

function idParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListBeitie.mockReturnValue([]);
  mockInsertBeitie.mockReturnValue(42);
  mockExistsSync.mockReturnValue(false);
});

// ── GET /api/admin/beitie ────────────────────────────────────────────────────

describe("GET /api/admin/beitie", () => {
  it("returns all beitie items", async () => {
    mockListBeitie.mockReturnValue([SAMPLE_ITEM]);
    const res = await adminListGET();
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("蘭亭集序");
  });

  it("calls listBeitie with no filter", async () => {
    await adminListGET();
    expect(mockListBeitie).toHaveBeenCalledWith();
  });
});

// ── POST /api/admin/beitie ───────────────────────────────────────────────────

describe("POST /api/admin/beitie", () => {
  it("creates an entry and returns the new id", async () => {
    mockInsertBeitie.mockReturnValue(5);
    const res = await adminPOST(
      makeRequest("/api/admin/beitie", jsonBody({
        title: "多寶塔碑",
        author: "顏真卿",
        dynasty: "唐",
        style: "楷書",
        styleSlug: "kai",
      }))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(5);
  });

  it("returns 400 when title is missing", async () => {
    const res = await adminPOST(
      makeRequest("/api/admin/beitie", jsonBody({
        author: "顏真卿",
        dynasty: "唐",
        style: "楷書",
        styleSlug: "kai",
      }))
    );
    expect(res.status).toBe(400);
    expect(mockInsertBeitie).not.toHaveBeenCalled();
  });

  it("returns 400 when author is missing", async () => {
    const res = await adminPOST(
      makeRequest("/api/admin/beitie", jsonBody({
        title: "多寶塔碑",
        dynasty: "唐",
        style: "楷書",
        styleSlug: "kai",
      }))
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when styleSlug is missing", async () => {
    const res = await adminPOST(
      makeRequest("/api/admin/beitie", jsonBody({
        title: "多寶塔碑",
        author: "顏真卿",
        dynasty: "唐",
        style: "楷書",
      }))
    );
    expect(res.status).toBe(400);
  });

  it("passes optional fields through to insertBeitie", async () => {
    await adminPOST(
      makeRequest("/api/admin/beitie", jsonBody({
        title: "多寶塔碑",
        author: "顏真卿",
        dynasty: "唐",
        style: "楷書",
        styleSlug: "kai",
        summary: "顏體代表作",
        tags: ["顏體", "楷書範本"],
        sourceCredit: "國立故宮博物院",
      }))
    );
    expect(mockInsertBeitie).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "顏體代表作",
        tags: ["顏體", "楷書範本"],
        sourceCredit: "國立故宮博物院",
      })
    );
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(new URL("http://localhost/api/admin/beitie"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await adminPOST(req);
    expect(res.status).toBe(400);
  });

  it("passes AI fields through to insertBeitie when provided", async () => {
    await adminPOST(
      makeRequest("/api/admin/beitie", jsonBody({
        title: "多寶塔碑",
        author: "顏真卿",
        dynasty: "唐",
        style: "楷書",
        styleSlug: "kai",
        aiHistory: "碑石歷史",
        aiBiography: "顏真卿生平",
        aiStyle: "楷書風格",
        aiInfluence: "顏體影響",
        aiStories: "書寫典故",
        aiPractice: "臨摹建議",
      }))
    );
    expect(mockInsertBeitie).toHaveBeenCalledWith(
      expect.objectContaining({
        aiHistory: "碑石歷史",
        aiBiography: "顏真卿生平",
        aiStyle: "楷書風格",
        aiInfluence: "顏體影響",
        aiStories: "書寫典故",
        aiPractice: "臨摹建議",
      })
    );
  });

  it("sets aiGeneratedAt to a non-null ISO string when at least one AI field is present", async () => {
    await adminPOST(
      makeRequest("/api/admin/beitie", jsonBody({
        title: "多寶塔碑",
        author: "顏真卿",
        dynasty: "唐",
        style: "楷書",
        styleSlug: "kai",
        aiHistory: "碑石歷史",
      }))
    );
    const call = mockInsertBeitie.mock.calls[0][0] as Record<string, unknown>;
    expect(call.aiGeneratedAt).not.toBeNull();
    expect(typeof call.aiGeneratedAt).toBe("string");
    // Must be a valid ISO 8601 date string
    expect(new Date(call.aiGeneratedAt as string).toISOString()).toBe(call.aiGeneratedAt);
  });

  it("sets aiGeneratedAt to null when no AI fields are provided", async () => {
    await adminPOST(
      makeRequest("/api/admin/beitie", jsonBody({
        title: "多寶塔碑",
        author: "顏真卿",
        dynasty: "唐",
        style: "楷書",
        styleSlug: "kai",
      }))
    );
    const call = mockInsertBeitie.mock.calls[0][0] as Record<string, unknown>;
    expect(call.aiGeneratedAt).toBeNull();
  });
});

// ── PATCH /api/admin/beitie/[id] ─────────────────────────────────────────────

describe("PATCH /api/admin/beitie/[id]", () => {
  it("updates an existing entry and returns ok", async () => {
    mockGetBeitieById.mockReturnValue(SAMPLE_ITEM);
    const res = await PATCH(
      makeRequest("/api/admin/beitie/1", { method: "PATCH", ...jsonBody({ summary: "新摘要" }) }),
      idParams("1")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockUpdateBeitie).toHaveBeenCalledWith(1, expect.objectContaining({ summary: "新摘要" }));
  });

  it("returns 404 when entry does not exist", async () => {
    mockGetBeitieById.mockReturnValue(null);
    const res = await PATCH(
      makeRequest("/api/admin/beitie/99", { method: "PATCH", ...jsonBody({ summary: "x" }) }),
      idParams("99")
    );
    expect(res.status).toBe(404);
    expect(mockUpdateBeitie).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await PATCH(
      makeRequest("/api/admin/beitie/abc", { method: "PATCH", ...jsonBody({}) }),
      idParams("abc")
    );
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/admin/beitie/[id] ────────────────────────────────────────────

describe("DELETE /api/admin/beitie/[id]", () => {
  it("deletes an existing entry and returns ok", async () => {
    mockGetBeitieById.mockReturnValue(SAMPLE_ITEM);
    const res = await DELETE(
      makeRequest("/api/admin/beitie/1", { method: "DELETE" }),
      idParams("1")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDeleteBeitie).toHaveBeenCalledWith(1);
  });

  it("returns 404 when entry does not exist", async () => {
    mockGetBeitieById.mockReturnValue(null);
    const res = await DELETE(
      makeRequest("/api/admin/beitie/99", { method: "DELETE" }),
      idParams("99")
    );
    expect(res.status).toBe(404);
    expect(mockDeleteBeitie).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await DELETE(
      makeRequest("/api/admin/beitie/xyz", { method: "DELETE" }),
      idParams("xyz")
    );
    expect(res.status).toBe(400);
  });
});

// ── GET /api/admin/beitie/npm-lookup ─────────────────────────────────────────

const SAMPLE_INDEX = {
  "故書001N": {
    identifier: "故書001N",
    name: "蘭亭集序",
    category: "法書",
    calligrapher: "王羲之",
    era: "東晉",
    styleSlug: "xing",
    sourceUrl: "https://npm.gov.tw/1",
    imageUrl: "https://npm.gov.tw/img/1",
    imagePages: [],
    iiifPages: [],
    shiwen: null,
    status: "pending",
  },
  "故帖002N": {
    identifier: "故帖002N",
    name: "多寶塔碑",
    category: "法帖",
    calligrapher: "顏真卿",
    era: "唐",
    styleSlug: "kai",
    sourceUrl: "https://npm.gov.tw/2",
    imageUrl: "https://npm.gov.tw/img/2",
    imagePages: ["https://npm.gov.tw/p1", "https://npm.gov.tw/p2"],
    iiifPages: [],
    shiwen: "多寶塔碑文",
    status: "done",
  },
};

function makeNpmRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/beitie/npm-lookup");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/admin/beitie/npm-lookup", () => {
  beforeEach(() => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(SAMPLE_INDEX));
  });

  it("returns empty results when q param is absent", async () => {
    const res = await npmLookupGET(makeNpmRequest());
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it("returns empty results when works_index.json is missing", async () => {
    mockExistsSync.mockReturnValue(false);
    const res = await npmLookupGET(makeNpmRequest({ q: "蘭亭" }));
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it("finds works by name substring", async () => {
    const res = await npmLookupGET(makeNpmRequest({ q: "蘭亭" }));
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].name).toBe("蘭亭集序");
  });

  it("finds works by calligrapher name", async () => {
    const res = await npmLookupGET(makeNpmRequest({ q: "顏真卿" }));
    const body = await res.json();
    expect(body.results[0].name).toBe("多寶塔碑");
  });

  it("looks up a work directly by identifier", async () => {
    const res = await npmLookupGET(makeNpmRequest({ id: "故書001N" }));
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].identifier).toBe("故書001N");
  });

  it("returns empty results for an unknown identifier", async () => {
    const res = await npmLookupGET(makeNpmRequest({ id: "XXXXXX" }));
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it("calculates pageCount from imagePages when populated", async () => {
    const res = await npmLookupGET(makeNpmRequest({ q: "多寶塔" }));
    const body = await res.json();
    expect(body.results[0].pageCount).toBe(2);
  });

  it("calculates pageCount as 1 when imagePages is empty but imageUrl exists", async () => {
    const res = await npmLookupGET(makeNpmRequest({ q: "蘭亭" }));
    const body = await res.json();
    expect(body.results[0].pageCount).toBe(1);
  });

  it("passes shiwen through from works_index entry", async () => {
    const res = await npmLookupGET(makeNpmRequest({ q: "多寶塔" }));
    const body = await res.json();
    expect(body.results[0].shiwen).toBe("多寶塔碑文");
  });

  it("returns shiwen as null when not set on the entry", async () => {
    const res = await npmLookupGET(makeNpmRequest({ q: "蘭亭" }));
    const body = await res.json();
    expect(body.results[0].shiwen).toBeNull();
  });

  it("is case-insensitive in search", async () => {
    const res = await npmLookupGET(makeNpmRequest({ q: "故書001N" }));
    const body = await res.json();
    expect(body.results).toHaveLength(1);
  });

  it("returns all result fields", async () => {
    const res = await npmLookupGET(makeNpmRequest({ q: "蘭亭" }));
    const body = await res.json();
    const result = body.results[0];
    expect(result).toMatchObject({
      identifier: "故書001N",
      name: "蘭亭集序",
      category: "法書",
      calligrapher: "王羲之",
      era: "東晉",
      styleSlug: "xing",
      sourceUrl: "https://npm.gov.tw/1",
      imageUrl: "https://npm.gov.tw/img/1",
      imagePages: [],
      pageCount: 1,
    });
  });
});
