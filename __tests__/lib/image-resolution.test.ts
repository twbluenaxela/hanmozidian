import { resolveCurrentImage, CharacterImage } from "@/lib/utils";

const imgs: CharacterImage[] = [
  { id: 1, imageUrl: "/images/1.png" },
  { id: 2, imageUrl: "/images/2.png" },
  { id: 3, imageUrl: "/images/3.png" },
];

describe("resolveCurrentImage", () => {
  describe("no images → always null (no broken img)", () => {
    it("returns null for an empty array", () => {
      expect(resolveCurrentImage([], undefined)).toBeNull();
    });

    it("returns null even when a selectedImageId is set", () => {
      expect(resolveCurrentImage([], 1)).toBeNull();
    });
  });

  describe("no selection → first image (safe default)", () => {
    it("returns images[0] when selectedImageId is undefined", () => {
      expect(resolveCurrentImage(imgs, undefined)).toBe(imgs[0]);
    });

    it("returns images[0] when selectedImageId is null", () => {
      // null can arrive from a freshly composed character with no prior state
      expect(resolveCurrentImage(imgs, null as any)).toBe(imgs[0]);
    });
  });

  describe("valid selection → correct alternative image", () => {
    it("returns the matching image when selectedImageId matches by number", () => {
      expect(resolveCurrentImage(imgs, 2)).toBe(imgs[1]);
    });

    it("returns the matching image when selectedImageId matches as a string", () => {
      // composition state stores the id as-clicked; DB returns numeric ids —
      // string coercion must bridge the gap
      expect(resolveCurrentImage(imgs, "3")).toBe(imgs[2]);
    });

    it("returns the matching image when the array has numeric ids but selectedImageId is a string", () => {
      const numericImgs: CharacterImage[] = [
        { id: 10, imageUrl: "/a.png" },
        { id: 20, imageUrl: "/b.png" },
      ];
      expect(resolveCurrentImage(numericImgs, "20")).toBe(numericImgs[1]);
    });
  });

  describe("stale / missing selection → fallback to images[0] (no broken img)", () => {
    it("falls back to images[0] when selectedImageId has no match", () => {
      // Happens when the user switches styles and the previously-selected ID
      // no longer exists in the new result set
      expect(resolveCurrentImage(imgs, 99)).toBe(imgs[0]);
    });

    it("falls back to images[0] when selectedImageId is a non-matching string", () => {
      expect(resolveCurrentImage(imgs, "999")).toBe(imgs[0]);
    });
  });

  describe("single-image character", () => {
    const oneImg: CharacterImage[] = [{ id: 7, imageUrl: "/single.png" }];

    it("returns the only image when no selection is set", () => {
      expect(resolveCurrentImage(oneImg, undefined)).toBe(oneImg[0]);
    });

    it("returns the only image when it is the selection", () => {
      expect(resolveCurrentImage(oneImg, 7)).toBe(oneImg[0]);
    });

    it("falls back to the only image when selection is stale", () => {
      expect(resolveCurrentImage(oneImg, 42)).toBe(oneImg[0]);
    });
  });
});
