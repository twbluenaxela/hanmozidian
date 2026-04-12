export function charToUnicodeHex(char: string): string {
  return char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Resolves an image_path (as stored in the DB) to a URL the browser can load.
 *
 * Paths starting with "images/" are R2 keys — use R2_PUBLIC_URL if set,
 * otherwise fall back to /images/ in public/.
 *
 * Paths starting with anything else (e.g. "placeholder/") are treated as
 * local-only (served from public/) regardless of R2_PUBLIC_URL.
 */
export function resolveImageUrl(imagePath: string): string {
  const r2PublicUrl = process.env.R2_PUBLIC_URL || "";
  if (imagePath.startsWith("images/") && r2PublicUrl) {
    return `${r2PublicUrl}/${imagePath}`;
  }
  return `/${imagePath}`;
}
