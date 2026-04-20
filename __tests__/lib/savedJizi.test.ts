/**
 * Tests for lib/savedJizi.ts
 * Covers: save limit enforcement, undefined sanitization, delete, hook wiring.
 */

import { saveJizi, deleteSavedJizi, MAX_SAVED_JIZI } from "@/lib/savedJizi";

// ── Firebase mocks ────────────────────────────────────────────────────────────

const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-col"),
  doc: jest.fn(() => "mock-doc"),
  setDoc: (...a: any[]) => mockSetDoc(...a),
  deleteDoc: (...a: any[]) => mockDeleteDoc(...a),
  getDocs: (...a: any[]) => mockGetDocs(...a),
  onSnapshot: (...a: any[]) => mockOnSnapshot(...a),
  serverTimestamp: jest.fn(() => "__SERVER_TS__"),
  query: jest.fn((c) => c),
  orderBy: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({ db: {} }));

// crypto.randomUUID may not be available in all jsdom versions
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => "test-uuid" },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const baseData = {
  text: "永",
  style: "kai",
  calligraphers: [],
  works: [],
  orientation: "horizontal" as const,
  gridSize: 120,
  gap: 16,
  paperId: "white",
  composition: {},
};

function mockSnapshot(size: number) {
  return Promise.resolve({ size });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockSetDoc.mockResolvedValue(undefined);
  mockDeleteDoc.mockResolvedValue(undefined);
});

describe("MAX_SAVED_JIZI", () => {
  it("is 10", () => {
    expect(MAX_SAVED_JIZI).toBe(10);
  });
});

describe("saveJizi", () => {
  it("saves successfully when under the limit", async () => {
    mockGetDocs.mockResolvedValue({ size: 0 });
    const result = await saveJizi("uid1", baseData);
    expect(result.error).toBeUndefined();
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it("saves when exactly one slot remains (size = 9)", async () => {
    mockGetDocs.mockResolvedValue({ size: MAX_SAVED_JIZI - 1 });
    const result = await saveJizi("uid1", baseData);
    expect(result.error).toBeUndefined();
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it("rejects when at the limit (size = 10)", async () => {
    mockGetDocs.mockResolvedValue({ size: MAX_SAVED_JIZI });
    const result = await saveJizi("uid1", baseData);
    expect(result.error).toMatch(/10/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("rejects when over the limit (size = 11)", async () => {
    mockGetDocs.mockResolvedValue({ size: MAX_SAVED_JIZI + 1 });
    const result = await saveJizi("uid1", baseData);
    expect(result.error).toBeDefined();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("strips undefined values from composition before writing", async () => {
    mockGetDocs.mockResolvedValue({ size: 0 });
    const dataWithUndefined = {
      ...baseData,
      composition: { "0": { selectedImageId: undefined, grid: "none", invert: false } },
    };
    await saveJizi("uid1", dataWithUndefined as any);
    const written = mockSetDoc.mock.calls[0][1];
    // JSON round-trip should have removed undefined
    expect(written.composition["0"]).not.toHaveProperty("selectedImageId");
  });

  it("preserves defined composition values", async () => {
    mockGetDocs.mockResolvedValue({ size: 0 });
    const data = {
      ...baseData,
      composition: { "0": { selectedImageId: 42, grid: "mi", invert: true } },
    };
    await saveJizi("uid1", data as any);
    const written = mockSetDoc.mock.calls[0][1];
    expect(written.composition["0"].selectedImageId).toBe(42);
    expect(written.composition["0"].grid).toBe("mi");
  });

  it("attaches serverTimestamp to every write", async () => {
    mockGetDocs.mockResolvedValue({ size: 0 });
    await saveJizi("uid1", baseData);
    const written = mockSetDoc.mock.calls[0][1];
    expect(written.savedAt).toBe("__SERVER_TS__");
  });

  it("saves optional thumbnail when provided", async () => {
    mockGetDocs.mockResolvedValue({ size: 0 });
    await saveJizi("uid1", { ...baseData, thumbnail: "data:image/png;base64,abc" });
    const written = mockSetDoc.mock.calls[0][1];
    expect(written.thumbnail).toBe("data:image/png;base64,abc");
  });

  it("saves without thumbnail when omitted", async () => {
    mockGetDocs.mockResolvedValue({ size: 0 });
    await saveJizi("uid1", baseData);
    const written = mockSetDoc.mock.calls[0][1];
    expect(written.thumbnail).toBeUndefined();
  });
});

describe("deleteSavedJizi", () => {
  it("calls deleteDoc with the correct doc ref", async () => {
    await deleteSavedJizi("uid1", "jizi-id-abc");
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe("useSavedJizi hook", () => {
  it("returns empty array when uid is null", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { useSavedJizi } = await import("@/lib/savedJizi");
    const { result } = renderHook(() => useSavedJizi(null));
    expect(result.current).toEqual([]);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it("subscribes to Firestore when uid is provided", async () => {
    mockOnSnapshot.mockReturnValue(() => {}); // unsubscribe fn
    const { renderHook } = await import("@testing-library/react");
    const { useSavedJizi } = await import("@/lib/savedJizi");
    renderHook(() => useSavedJizi("uid1"));
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it("maps Firestore docs to SavedJizi objects", async () => {
    const fakeDocs = [
      { id: "doc1", data: () => ({ text: "永", style: "kai", savedAt: 1 }) },
    ];
    mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
      cb({ docs: fakeDocs });
      return () => {};
    });
    const { renderHook } = await import("@testing-library/react");
    const { useSavedJizi } = await import("@/lib/savedJizi");
    const { result } = renderHook(() => useSavedJizi("uid1"));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe("doc1");
    expect(result.current[0].text).toBe("永");
  });

  it("unsubscribes on unmount", async () => {
    const unsubscribe = jest.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);
    const { renderHook } = await import("@testing-library/react");
    const { useSavedJizi } = await import("@/lib/savedJizi");
    const { unmount } = renderHook(() => useSavedJizi("uid1"));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
