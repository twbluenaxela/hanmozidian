import * as OpenCC from "opencc-js";

const convert = OpenCC.Converter({ from: "cn", to: "tw" });

export function simplifiedToTraditional(s: string): string {
  return convert(s);
}
