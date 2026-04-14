export function charToUnicodeHex(char: string): string {
  return char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Resolves an image_path (as stored in the DB) to a URL the browser can load.
 *
 * Paths starting with "images/" live on R2 in production. Rewriting happens
 * only when USE_R2=true AND R2_PUBLIC_URL is set — otherwise we serve from
 * public/ locally. This lets dev machines keep R2 credentials in .env.local
 * for the upload script without having every <img> 404 against an R2 bucket
 * that may not be populated yet.
 */
export function resolveImageUrl(imagePath: string): string {
  const useR2 = process.env.USE_R2 === "true";
  const r2PublicUrl = process.env.R2_PUBLIC_URL || "";
  if (imagePath.startsWith("images/") && useR2 && r2PublicUrl) {
    return `${r2PublicUrl}/${imagePath}`;
  }
  return `/${imagePath}`;
}
