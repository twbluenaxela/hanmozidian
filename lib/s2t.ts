import * as OpenCC from "opencc-js";

// Building the converter constructs a lookup trie from OpenCC's dictionaries.
// Defer that work until the first conversion so it stays off the server's
// cold-start path, then memoize the single instance.
let convert: ((s: string) => string) | null = null;

export function simplifiedToTraditional(s: string): string {
  if (!convert) {
    convert = OpenCC.Converter({ from: "cn", to: "tw" });
  }
  return convert(s);
}
