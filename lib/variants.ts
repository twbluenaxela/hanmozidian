import variantGroupsData from "@/data/variant_groups.json";

interface VariantGroup {
  simp: string;
  variants: string[];
  counts: Record<string, number>;
  total: number;
}

const groups = variantGroupsData as unknown as VariantGroup[];

// Map each traditional character → full sibling list (including itself)
const charToGroup = new Map<string, string[]>();
for (const g of groups) {
  for (const v of g.variants) {
    charToGroup.set(v, g.variants);
  }
}

/** Returns all characters in the same variant group, or null if no siblings exist. */
export function getVariantGroup(char: string): string[] | null {
  return charToGroup.get(char) ?? null;
}

/** Returns the sibling characters (excluding self), or null if none. */
export function getVariantSiblings(char: string): string[] | null {
  const group = charToGroup.get(char);
  if (!group) return null;
  const siblings = group.filter((c) => c !== char);
  return siblings.length > 0 ? siblings : null;
}
