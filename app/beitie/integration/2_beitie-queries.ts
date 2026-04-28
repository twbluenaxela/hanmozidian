// lib/db/beitie-queries.ts
// Drop this file into lib/db/ alongside your existing queries.ts
// Adjust the `db` import to match however you instantiate better-sqlite3.

import { db } from "@/lib/db"; // ← your existing db singleton

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
  aiHistory: string | null;
  aiBiography: string | null;
  aiStyle: string | null;
  aiInfluence: string | null;
  aiStories: string | null;
  aiPractice: string | null;
  aiGeneratedAt: string | null;
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
    aiHistory: (row.ai_history as string) ?? null,
    aiBiography: (row.ai_biography as string) ?? null,
    aiStyle: (row.ai_style as string) ?? null,
    aiInfluence: (row.ai_influence as string) ?? null,
    aiStories: (row.ai_stories as string) ?? null,
    aiPractice: (row.ai_practice as string) ?? null,
    aiGeneratedAt: (row.ai_generated_at as string) ?? null,
  };
}

/** List all 碑帖, optionally filtered by style slug */
export function listBeitie(styleSlug?: string): BeitieRow[] {
  const rows = styleSlug
    ? db.prepare("SELECT * FROM beitie WHERE style_slug = ? ORDER BY id").all(styleSlug)
    : db.prepare("SELECT * FROM beitie ORDER BY id").all();
  return (rows as Record<string, unknown>[]).map(parseRow);
}

/** Fetch a single 碑帖 by id */
export function getBeitieById(id: number): BeitieRow | null {
  const row = db.prepare("SELECT * FROM beitie WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? parseRow(row) : null;
}

/** Upsert AI sections after generation */
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
  db.prepare(`
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

/** Insert a new 碑帖 (used by admin upload form later) */
export function insertBeitie(data: {
  title: string;
  author: string;
  dynasty: string;
  style: string;
  styleSlug: string;
  yearLabel?: string;
  medium?: string;
  charCount?: number;
  summary?: string;
  tags?: string[];
  coverImage?: string;
  pages?: string[];
}): number {
  const result = db.prepare(`
    INSERT INTO beitie
      (title, author, dynasty, style, style_slug, year_label, medium,
       char_count, summary, tags, cover_image, pages_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    JSON.stringify(data.pages ?? [])
  );
  return result.lastInsertRowid as number;
}
