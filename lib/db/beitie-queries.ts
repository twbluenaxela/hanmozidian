import { d1Query, isD1Configured } from "@/lib/db/d1-client";

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

function ensureD1Configured() {
  if (!isD1Configured()) {
    throw new Error(
      "D1 is required for beitie data. Missing CF_ACCOUNT_ID, CF_API_TOKEN, or D1_DATABASE_ID."
    );
  }
}

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

export async function listBeitie(styleSlug?: string): Promise<BeitieRow[]> {
  ensureD1Configured();
  const rows = styleSlug
    ? await d1Query("SELECT * FROM beitie WHERE style_slug = ? ORDER BY id", [styleSlug])
    : await d1Query("SELECT * FROM beitie ORDER BY id");
  return rows.map(parseRow);
}

export async function getBeitieById(id: number): Promise<BeitieRow | null> {
  ensureD1Configured();
  const rows = await d1Query("SELECT * FROM beitie WHERE id = ?", [id]);
  return rows[0] ? parseRow(rows[0]) : null;
}

export async function insertBeitie(data: {
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
}): Promise<number> {
  ensureD1Configured();
  const rows = await d1Query(
    `INSERT INTO beitie
      (title, author, dynasty, style, style_slug, year_label, medium,
       char_count, summary, tags, cover_image, pages_json,
       shiwen, source_credit, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id`,
    [
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
      data.sourceUrl ?? null,
    ]
  );
  const inserted = rows[0]?.id;
  if (typeof inserted !== "number") throw new Error("Failed to insert beitie row in D1.");
  return inserted;
}

export async function updateBeitie(id: number, fields: BeitieUpdateFields): Promise<void> {
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
  ensureD1Configured();
  values.push(id);
  await d1Query(`UPDATE beitie SET ${setClauses.join(", ")} WHERE id = ?`, values);
}

export async function deleteBeitie(id: number): Promise<void> {
  ensureD1Configured();
  await d1Query("DELETE FROM beitie WHERE id = ?", [id]);
}

export async function saveAiSummary(
  id: number,
  sections: {
    history: string;
    biography: string;
    style: string;
    influence: string;
    stories: string;
    practice: string;
  }
): Promise<void> {
  ensureD1Configured();
  await d1Query(
    `UPDATE beitie SET
      ai_history    = ?,
      ai_biography  = ?,
      ai_style      = ?,
      ai_influence  = ?,
      ai_stories    = ?,
      ai_practice   = ?,
      ai_generated_at = datetime('now'),
      updated_at    = datetime('now')
    WHERE id = ?`,
    [
      sections.history,
      sections.biography,
      sections.style,
      sections.influence,
      sections.stories,
      sections.practice,
      id,
    ]
  );
}
