import { charToUnicodeHex, resolveImageUrl } from "@/lib/utils";

describe("charToUnicodeHex", () => {
  it("converts a CJK character to its hex code point", () => {
    expect(charToUnicodeHex("永")).toBe("6C38");
  });

  it("converts a basic ASCII character", () => {
    expect(charToUnicodeHex("A")).toBe("0041");
  });

  it("pads to at least 4 digits", () => {
    // U+0031 = '1'
    expect(charToUnicodeHex("1")).toBe("0031");
  });

  it("handles supplementary plane characters (> U+FFFF)", () => {
    // U+20000 = first CJK Unified Ideograph Extension B character
    const char = String.fromCodePoint(0x20000);
    expect(charToUnicodeHex(char)).toBe("20000");
  });
});

describe("resolveImageUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns a root-relative path when R2 is not enabled", () => {
    delete process.env.USE_R2;
    expect(resolveImageUrl("images/kai/abc.png")).toBe("/images/kai/abc.png");
  });

  it("returns a root-relative path when USE_R2 is false", () => {
    process.env.USE_R2 = "false";
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
    expect(resolveImageUrl("images/kai/abc.png")).toBe("/images/kai/abc.png");
  });

  it("returns a root-relative path when R2_PUBLIC_URL is missing", () => {
    process.env.USE_R2 = "true";
    delete process.env.R2_PUBLIC_URL;
    expect(resolveImageUrl("images/kai/abc.png")).toBe("/images/kai/abc.png");
  });

  it("prepends R2 URL when USE_R2=true and R2_PUBLIC_URL is set", () => {
    process.env.USE_R2 = "true";
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
    expect(resolveImageUrl("images/kai/abc.png")).toBe(
      "https://cdn.example.com/images/kai/abc.png"
    );
  });

  it("does not rewrite paths that do not start with 'images/'", () => {
    process.env.USE_R2 = "true";
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
    expect(resolveImageUrl("public/logo.png")).toBe("/public/logo.png");
  });
});
