/**
 * Tests for lib/favorites.ts
 * Key regression: Firestore stores `imageId` but type expects `id` —
 * the hook must map imageId → id so list keys are never undefined.
 */

import { addFavorite, removeFavorite } from "@/lib/favorites";

const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => "mock-doc"),
  setDoc: (...a: any[]) => mockSetDoc(...a),
  deleteDoc: (...a: any[]) => mockDeleteDoc(...a),
  collection: jest.fn(() => "mock-col"),
  onSnapshot: (...a: any[]) => mockOnSnapshot(...a),
  serverTimestamp: jest.fn(() => "__TS__"),
}));

jest.mock("@/lib/firebase", () => ({ db: {} }));

const image = {
  id: 42,
  imagePath: "/img/test.jpg",
  imageUrl: "https://cdn.example.com/img/test.jpg",
  character: "永",
  styleSlug: "kai",
  calligrapherName: "王羲之",
};

beforeEach(() => jest.clearAllMocks());

describe("addFavorite", () => {
  it("writes imageId field to Firestore", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await addFavorite("uid1", image);
    const written = mockSetDoc.mock.calls[0][1];
    expect(written.imageId).toBe(42);
  });

  it("writes all image fields", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await addFavorite("uid1", image);
    const written = mockSetDoc.mock.calls[0][1];
    expect(written.character).toBe("永");
    expect(written.imagePath).toBe("/img/test.jpg");
    expect(written.styleSlug).toBe("kai");
    expect(written.calligrapherName).toBe("王羲之");
  });

  it("attaches serverTimestamp", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await addFavorite("uid1", image);
    const written = mockSetDoc.mock.calls[0][1];
    expect(written.savedAt).toBe("__TS__");
  });

  it("handles null calligrapherName", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await addFavorite("uid1", { ...image, calligrapherName: null });
    const written = mockSetDoc.mock.calls[0][1];
    expect(written.calligrapherName).toBeNull();
  });
});

describe("removeFavorite", () => {
  it("calls deleteDoc once", async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    await removeFavorite("uid1", 42);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe("useFavorites hook", () => {
  it("returns empty array when uid is null", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { useFavorites } = await import("@/lib/favorites");
    const { result } = renderHook(() => useFavorites(null));
    expect(result.current).toEqual([]);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it("subscribes when uid is provided", async () => {
    mockOnSnapshot.mockReturnValue(() => {});
    const { renderHook } = await import("@testing-library/react");
    const { useFavorites } = await import("@/lib/favorites");
    renderHook(() => useFavorites("uid1"));
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it("maps imageId to id (regression: was undefined before fix)", async () => {
    const fakeDocs = [
      { data: () => ({ imageId: 99, character: "永", imagePath: "/x.jpg", styleSlug: "kai", calligrapherName: null }) },
    ];
    mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
      cb({ docs: fakeDocs });
      return () => {};
    });
    const { renderHook } = await import("@testing-library/react");
    const { useFavorites } = await import("@/lib/favorites");
    const { result } = renderHook(() => useFavorites("uid1"));
    expect(result.current[0].id).toBe(99);
  });

  it("returns multiple favorites in snapshot order", async () => {
    const fakeDocs = [
      { data: () => ({ imageId: 1, character: "永" }) },
      { data: () => ({ imageId: 2, character: "山" }) },
      { data: () => ({ imageId: 3, character: "水" }) },
    ];
    mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
      cb({ docs: fakeDocs });
      return () => {};
    });
    const { renderHook } = await import("@testing-library/react");
    const { useFavorites } = await import("@/lib/favorites");
    const { result } = renderHook(() => useFavorites("uid1"));
    expect(result.current).toHaveLength(3);
    expect(result.current.map((f) => f.id)).toEqual([1, 2, 3]);
  });

  it("clears list when uid becomes null", async () => {
    mockOnSnapshot.mockReturnValue(() => {});
    const { renderHook } = await import("@testing-library/react");
    const { useFavorites } = await import("@/lib/favorites");
    const { result, rerender } = renderHook(({ uid }: { uid: string | null }) => useFavorites(uid), {
      initialProps: { uid: "uid1" as string | null },
    });
    rerender({ uid: null });
    expect(result.current).toEqual([]);
  });

  it("unsubscribes on unmount", async () => {
    const unsubscribe = jest.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);
    const { renderHook } = await import("@testing-library/react");
    const { useFavorites } = await import("@/lib/favorites");
    const { unmount } = renderHook(() => useFavorites("uid1"));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
