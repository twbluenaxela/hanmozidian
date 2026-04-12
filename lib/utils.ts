export function charToUnicodeHex(char: string): string {
  return char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
}

export function getR2PublicUrl(imagePath: string): string {
  const baseUrl = process.env.R2_PUBLIC_URL || "";
  if (!baseUrl) {
    return `/api/images/${encodeURIComponent(imagePath)}`;
  }
  return `${baseUrl}/${imagePath}`;
}
