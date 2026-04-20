import { addFavorite, removeFavorite } from "@/lib/favorites";

// Capture Firestore calls
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockDoc = jest.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") }));
const mockOnSnapshot = jest.fn();
const mockCollection = jest.fn();

jest.mock("@/lib/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: (db: unknown, ...path: string[]) => mockDoc(db, ...path),
  setDoc: (ref: unknown, data: unknown) => mockSetDoc(ref, data),
  deleteDoc: (ref: unknown) => mockDeleteDoc(ref),
  onSnapshot: (ref: unknown, cb: unknown) => mockOnSnapshot(ref, cb),
  collection: (db: unknown, ...path: string[]) => mockCollection(db, ...path),
  serverTimestamp: () => "SERVER_TIMESTAMP",
}));

beforeEach(() => jest.clearAllMocks());

const sampleImage = {
  id: 42,
  imagePath: "/images/yong.png",
  character: "永",
  styleSlug: "kaishu",
  calligrapherName: "顏真卿",
};

describe("addFavorite", () => {
  it("calls setDoc at the correct Firestore path", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await addFavorite("uid123", sampleImage);
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "users", "uid123", "favorites", "42");
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        imageId: 42,
        character: "永",
        styleSlug: "kaishu",
        calligrapherName: "顏真卿",
        imagePath: "/images/yong.png",
        savedAt: "SERVER_TIMESTAMP",
      })
    );
  });
});

describe("removeFavorite", () => {
  it("calls deleteDoc at the correct Firestore path", async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    await removeFavorite("uid123", 42);
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "users", "uid123", "favorites", "42");
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
