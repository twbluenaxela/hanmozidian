import { sqlite } from "@/lib/db";

export interface BeitieRow {
  id: number;
  title: string;
  author: string;
  dynasty: string;
  style: string;
  styleSlug: string;
  yearLabel: string | null;
  medium: string | null;
  charCount: number | null;
  summary: string | null;
  tags: string[];
  coverImage: string | null;
  pages: string[];
  shiwen: string | null;
  sourceCredit: string | null;
  sourceUrl: string | null;
  aiHistory: string | null;
  aiBiography: string | null;
  aiStyle: string | null;
  aiInfluence: string | null;
  aiStories: string | null;
  aiPractice: string | null;
  aiGeneratedAt: string | null;
}

export type BeitieUpdateFields = Partial<{
  title: string;
  author: string;
  dynasty: string;
  style: string;
  styleSlug: string;
  yearLabel: string | null;
  medium: string | null;
  charCount: number | null;
  summary: string | null;
  tags: string[];
  coverImage: string | null;
  pages: string[];
  shiwen: string | null;
  sourceCredit: string | null;
  sourceUrl: string | null;
  aiHistory: string | null;
  aiBiography: string | null;
  aiStyle: string | null;
  aiInfluence: string | null;
  aiStories: string | null;
  aiPractice: string | null;
  aiGeneratedAt: string | null;
}>;

function parseRow(row: Record<string, unknown>): BeitieRow {
  return {
    id: row.id as number,
    title: row.title as string,
    author: row.author as string,
    dynasty: row.dynasty as string,
    style: row.style as string,
    styleSlug: row.style_slug as string,
    yearLabel: (row.year_label as string) ?? null,
    medium: (row.medium as string) ?? null,
    charCount: (row.char_count as number) ?? null,
    summary: (row.summary as string) ?? null,
    tags: JSON.parse((row.tags as string) || "[]"),
    coverImage: (row.cover_image as string) ?? null,
    pages: JSON.parse((row.pages_json as string) || "[]"),
    shiwen: (row.shiwen as string) ?? null,
    sourceCredit: (row.source_credit as string) ?? null,
    sourceUrl: (row.source_url as string) ?? null,
    aiHistory: (row.ai_history as string) ?? null,
    aiBiography: (row.ai_biography as string) ?? null,
    aiStyle: (row.ai_style as string) ?? null,
    aiInfluence: (row.ai_influence as string) ?? null,
    aiStories: (row.ai_stories as string) ?? null,
    aiPractice: (row.ai_practice as string) ?? null,
    aiGeneratedAt: (row.ai_generated_at as string) ?? null,
  };
}

export function listBeitie(styleSlug?: string): BeitieRow[] {
  const rows = styleSlug
    ? sqlite.prepare("SELECT * FROM beitie WHERE style_slug = ? ORDER BY id").all(styleSlug)
    : sqlite.prepare("SELECT * FROM beitie ORDER BY id").all();
  return (rows as Record<string, unknown>[]).map(parseRow);
}

export function getBeitieById(id: number): BeitieRow | null {
  const row = sqlite.prepare("SELECT * FROM beitie WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? parseRow(row) : null;
}

export function insertBeitie(data: {
  title: string;
  author: string;
  dynasty: string;
  style: string;
  styleSlug: string;
  yearLabel?: string | null;
  medium?: string | null;
  charCount?: number | null;
  summary?: string | null;
  tags?: string[];
  coverImage?: string | null;
  pages?: string[];
  shiwen?: string | null;
  sourceCredit?: string | null;
  sourceUrl?: string | null;
}): number {
  const result = sqlite.prepare(`
    INSERT INTO beitie
      (title, author, dynasty, style, style_slug, year_label, medium,
       char_count, summary, tags, cover_image, pages_json,
       shiwen, source_credit, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.title,
    data.author,
    data.dynasty,
    data.style,
    data.styleSlug,
    data.yearLabel ?? null,
    data.medium ?? null,
    data.charCount ?? null,
    data.summary ?? null,
    JSON.stringify(data.tags ?? []),
    data.coverImage ?? null,
    JSON.stringify(data.pages ?? []),
    data.shiwen ?? null,
    data.sourceCredit ?? null,
    data.sourceUrl ?? null
  );
  return result.lastInsertRowid as number;
}

export function updateBeitie(id: number, fields: BeitieUpdateFields): void {
  const colMap: Record<string, string> = {
    title: "title",
    author: "author",
    dynasty: "dynasty",
    style: "style",
    styleSlug: "style_slug",
    yearLabel: "year_label",
    medium: "medium",
    charCount: "char_count",
    summary: "summary",
    coverImage: "cover_image",
    shiwen: "shiwen",
    sourceCredit: "source_credit",
    sourceUrl: "source_url",
    aiHistory: "ai_history",
    aiBiography: "ai_biography",
    aiStyle: "ai_style",
    aiInfluence: "ai_influence",
    aiStories: "ai_stories",
    aiPractice: "ai_practice",
    aiGeneratedAt: "ai_generated_at",
  };

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, col] of Object.entries(colMap)) {
    if (key in fields) {
      setClauses.push(`${col} = ?`);
      const val = (fields as Record<string, unknown>)[key];
      values.push(val);
    }
  }

  // tags and pages need JSON serialization
  if ("tags" in fields) {
    setClauses.push("tags = ?");
    values.push(JSON.stringify(fields.tags ?? []));
  }
  if ("pages" in fields) {
    setClauses.push("pages_json = ?");
    values.push(JSON.stringify(fields.pages ?? []));
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  sqlite.prepare(`UPDATE beitie SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteBeitie(id: number): void {
  sqlite.prepare("DELETE FROM beitie WHERE id = ?").run(id);
}

export function saveAiSummary(
  id: number,
  sections: {
    history: string;
    biography: string;
    style: string;
    influence: string;
    stories: string;
    practice: string;
  }
) {
  sqlite.prepare(`
    UPDATE beitie SET
      ai_history    = ?,
      ai_biography  = ?,
      ai_style      = ?,
      ai_influence  = ?,
      ai_stories    = ?,
      ai_practice   = ?,
      ai_generated_at = datetime('now'),
      updated_at    = datetime('now')
    WHERE id = ?
  `).run(
    sections.history,
    sections.biography,
    sections.style,
    sections.influence,
    sections.stories,
    sections.practice,
    id
  );
}
