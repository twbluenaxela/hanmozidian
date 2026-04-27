import { db } from "./index";
import {
  characters,
  scriptStyles,
  calligraphers,
  works,
  calligraphyImages,
} from "./schema";
import { eq, and, sql, count, inArray, desc } from "drizzle-orm";

/** Full-text search across the characters table, up to 50 results. */
export function searchCharacters(query: string) {
  return db
    .select({
      id: characters.id,
      character: characters.character,
      unicodeHex: characters.unicodeHex,
    })
    .from(characters)
    .where(sql`${characters.character} LIKE ${`%${query}%`}`)
    .limit(50)
    .all();
}

/** Look up a single character row by its glyph. Returns undefined if not in the dictionary. */
export function getCharacterByChar(char: string) {
  return db
    .select()
    .from(characters)
    .where(eq(characters.character, char))
    .get();
}

/** Returns per-style image counts for a character — used to populate the style tab bar. */
export function getStyleCounts(characterId: number) {
  return db
    .select({
      styleId: calligraphyImages.styleId,
      nameZh: scriptStyles.nameZh,
      slug: scriptStyles.slug,
      sortOrder: scriptStyles.sortOrder,
      count: count(),
    })
    .from(calligraphyImages)
    .innerJoin(scriptStyles, eq(calligraphyImages.styleId, scriptStyles.id))
    .where(eq(calligraphyImages.characterId, characterId))
    .groupBy(calligraphyImages.styleId)
    .orderBy(scriptStyles.sortOrder)
    .all();
}

/**
 * Paginated image query for a single character with optional style,
 * calligrapher, and work filters. Pass `random: true` for shuffle order
 * (used by the jizi canvas to vary default selections).
 */
export function getImages(opts: {
  characterId: number;
  styleSlug?: string;
  calligrapherIds?: number[];
  workIds?: number[];
  page?: number;
  limit?: number;
  random?: boolean;
}) {
  const {
    characterId,
    styleSlug,
    calligrapherIds,
    workIds,
    page = 1,
    limit = 50,
    random = false,
  } = opts;

  const conditions = [eq(calligraphyImages.characterId, characterId)];

  if (styleSlug) {
    const style = db
      .select({ id: scriptStyles.id })
      .from(scriptStyles)
      .where(eq(scriptStyles.slug, styleSlug))
      .get();
    if (!style) return []; // unknown slug — nothing can match
    
    conditions.push(eq(calligraphyImages.styleId, style.id));
  }

  if (calligrapherIds && calligrapherIds.length > 0) {
    conditions.push(inArray(calligraphyImages.calligrapherId, calligrapherIds));
  }

  if (workIds && workIds.length > 0) {
    conditions.push(inArray(calligraphyImages.workId, workIds));
  }

  const offset = (page - 1) * limit;

  return db
    .select({
      id: calligraphyImages.id,
      imagePath: calligraphyImages.imagePath,
      calligrapherName: calligraphers.nameZh,
      calligrapherId: calligraphyImages.calligrapherId,
      workName: works.nameZh,
      workId: calligraphyImages.workId,
      styleName: scriptStyles.nameZh,
      styleSlug: scriptStyles.slug,
      source: calligraphyImages.source,
    })
    .from(calligraphyImages)
    .leftJoin(calligraphers, eq(calligraphyImages.calligrapherId, calligraphers.id))
    .leftJoin(works, eq(calligraphyImages.workId, works.id))
    .innerJoin(scriptStyles, eq(calligraphyImages.styleId, scriptStyles.id))
    .where(and(...conditions))
    .orderBy(random ? sql`RANDOM()` : calligraphyImages.id)
    .limit(limit)
    .offset(offset)
    .all();
}

/** Returns distinct calligraphers who have at least one image for the given character. */
export function getCalligraphersForCharacter(characterId: number, styleSlug?: string) {
  const conditions = [eq(calligraphyImages.characterId, characterId)];

  if (styleSlug) {
    const style = db
      .select({ id: scriptStyles.id })
      .from(scriptStyles)
      .where(eq(scriptStyles.slug, styleSlug))
      .get();
    if (style) {
      conditions.push(eq(calligraphyImages.styleId, style.id));
    }
  }

  return db
    .selectDistinct({
      id: calligraphers.id,
      nameZh: calligraphers.nameZh,
      dynasty: calligraphers.dynasty,
    })
    .from(calligraphyImages)
    .innerJoin(calligraphers, eq(calligraphyImages.calligrapherId, calligraphers.id))
    .where(and(...conditions))
    .all();
}

/** Returns works, optionally filtered to those by a specific calligrapher or style. */
export function getWorksForFilter(opts: {
  calligrapherId?: number;
  styleSlug?: string;
}) {
  const conditions = [];

  if (opts.calligrapherId) {
    conditions.push(eq(works.calligrapherId, opts.calligrapherId));
  }
  if (opts.styleSlug) {
    const style = db
      .select({ id: scriptStyles.id })
      .from(scriptStyles)
      .where(eq(scriptStyles.slug, opts.styleSlug))
      .get();
    if (style) {
      conditions.push(eq(works.styleId, style.id));
    }
  }

  if (conditions.length === 0) {
    return db.select().from(works).all();
  }

  return db
    .select()
    .from(works)
    .where(and(...conditions))
    .all();
}

/** Returns all script styles sorted by their display order. */
export function getAllStyles() {
  return db
    .select()
    .from(scriptStyles)
    .orderBy(scriptStyles.sortOrder)
    .all();
}

/**
 * Facet data for the 集字 picker. Given the character ids
 * in the typed phrase (and optionally a style filter), 
 * returns every calligrapher and every work — each 
 * annotated with the total number of matching images.
 *
 * Zero-count rows are included (LEFT JOIN) so the UI can
 * render grayed-out chips without a second fetch.
 */
export function getJiziCoverage(opts: {
  characterIds: number[];
  styleSlug?: string;
}) {
  const { characterIds, styleSlug } = opts;

  if (characterIds.length === 0) {
    return { calligraphers: [], works: [] };
  }

  let styleId: number | undefined;
  if (styleSlug) {
    const style = db
      .select({ id: scriptStyles.id })
      .from(scriptStyles)
      .where(eq(scriptStyles.slug, styleSlug))
      .get();
    styleId = style?.id;
    
    // If slug was provided but doesn't match a style, 
    // return zeros.
    if (!styleId) {
      const allCalligraphers = db
        .select({
          id: calligraphers.id,
          nameZh: calligraphers.nameZh,
          dynasty: calligraphers.dynasty,
        })
        .from(calligraphers)
        .orderBy(calligraphers.nameZh)
        .all();
      return {
        calligraphers: allCalligraphers.map((c) => ({ ...c, imageCount: 0 })),
        works: [],
      };
    }
  }

  // --- Calligraphers facet ---
  // Filter predicates live in the LEFT JOIN ON clause — 
  // putting them in WHERE would drop calligraphers with 
  // zero matches.
  const calligrapherJoinConds = [
    eq(calligraphyImages.calligrapherId, calligraphers.id),
    inArray(calligraphyImages.characterId, characterIds),
  ];
  if (styleId != null) {
    calligrapherJoinConds.push(eq(calligraphyImages.styleId, styleId));
  }

  const calligrapherRows = db
    .select({
      id: calligraphers.id,
      nameZh: calligraphers.nameZh,
      dynasty: calligraphers.dynasty,
      imageCount: count(calligraphyImages.id),
    })
    .from(calligraphers)
    .leftJoin(
      calligraphyImages,
      and(...calligrapherJoinConds)
    )
    .groupBy(calligraphers.id)
    .orderBy(sql`count(${calligraphyImages.id}) desc`, calligraphers.nameZh)
    .all();

  // --- Works facet ---
  const workJoinConds = [
    eq(calligraphyImages.workId, works.id),
    inArray(calligraphyImages.characterId, characterIds),
  ];
  if (styleId != null) {
    workJoinConds.push(eq(calligraphyImages.styleId, styleId));
  }

  const workRows = db
    .select({
      id: works.id,
      nameZh: works.nameZh,
      calligrapherName: calligraphers.nameZh,
      imageCount: count(calligraphyImages.id),
    })
    .from(works)
    .leftJoin(calligraphyImages, and(...workJoinConds))
    .leftJoin(calligraphers, eq(works.calligrapherId, calligraphers.id))
    .groupBy(works.id)
    .orderBy(sql`count(${calligraphyImages.id}) desc`, works.nameZh)
    .all();

  return {
    calligraphers: calligrapherRows.map((r) => ({
      id: r.id,
      nameZh: r.nameZh,
      dynasty: r.dynasty,
      imageCount: Number(r.imageCount),
    })),
    works: workRows.map((r) => ({
      id: r.id,
      nameZh: r.nameZh,
      calligrapherName: r.calligrapherName,
      imageCount: Number(r.imageCount),
    })),
  };
}

/** Resolves a work id to its Chinese name, or null if the work doesn't exist. */
export function getWorkNameById(workId: number): string | null {
  const row = db
    .select({ nameZh: works.nameZh })
    .from(works)
    .where(eq(works.id, workId))
    .get();
  return row?.nameZh ?? null;
}

/**
 * Browse/gallery query — returns paginated images across ALL characters,
 * optionally filtered by calligrapher(s) or work(s). Includes the character
 * glyph so each image card can display what character it shows.
 */
export function getGalleryImages(opts: {
  calligrapherIds?: number[];
  workIds?: number[];
  page?: number;
  limit?: number;
}) {
  const { calligrapherIds, workIds, page = 1, limit = 20 } = opts;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (calligrapherIds && calligrapherIds.length > 0) {
    conditions.push(inArray(calligraphyImages.calligrapherId, calligrapherIds));
  }
  if (workIds && workIds.length > 0) {
    conditions.push(inArray(calligraphyImages.workId, workIds));
  }

  return db
    .select({
      id: calligraphyImages.id,
      imagePath: calligraphyImages.imagePath,
      character: characters.character,
      calligrapherName: calligraphers.nameZh,
      calligrapherId: calligraphyImages.calligrapherId,
      workName: works.nameZh,
      workId: calligraphyImages.workId,
      styleName: scriptStyles.nameZh,
      styleSlug: scriptStyles.slug,
    })
    .from(calligraphyImages)
    .innerJoin(characters, eq(calligraphyImages.characterId, characters.id))
    .leftJoin(calligraphers, eq(calligraphyImages.calligrapherId, calligraphers.id))
    .leftJoin(works, eq(calligraphyImages.workId, works.id))
    .innerJoin(scriptStyles, eq(calligraphyImages.styleId, scriptStyles.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(calligraphyImages.id)
    .limit(limit)
    .offset(offset)
    .all();
}

/**
 * Corpus-ordered gallery query for a single work. Sorts images so that
 * characters appear in the order they occur in the work's source text,
 * with any characters not present in the corpus sorted last. Pagination
 * happens entirely in SQLite — no rows are loaded into Node beyond the
 * requested page.
 *
 * Uses a CASE WHEN expression to encode corpus rank directly in SQL.
 * charOrder should come from charOrderFromText() on the corpus piece text.
 */
export function getGalleryImagesCorpusOrdered(opts: {
  workId: number;
  charOrder: string[];
  page: number;
  limit: number;
}): { images: ReturnType<typeof getGalleryImages>; hasMore: boolean } {
  const { workId, charOrder, page, limit } = opts;
  const offset = (page - 1) * limit;

  // Build: CASE "characters"."character" WHEN 'ch0' THEN 0 WHEN 'ch1' THEN 1 ... ELSE N END
  // Characters absent from the corpus sort last (rank = charOrder.length).
  const orderExpr = charOrder.length > 0
    ? sql`CASE ${characters.character} ${sql.join(
        charOrder.map((ch, i) => sql`WHEN ${ch} THEN ${i}`),
        sql` `
      )} ELSE ${charOrder.length} END`
    : calligraphyImages.id;

  // Fetch limit+1 rows so we can detect hasMore without a separate COUNT query.
  const rows = db
    .select({
      id: calligraphyImages.id,
      imagePath: calligraphyImages.imagePath,
      character: characters.character,
      calligrapherName: calligraphers.nameZh,
      calligrapherId: calligraphyImages.calligrapherId,
      workName: works.nameZh,
      workId: calligraphyImages.workId,
      styleName: scriptStyles.nameZh,
      styleSlug: scriptStyles.slug,
    })
    .from(calligraphyImages)
    .innerJoin(characters, eq(calligraphyImages.characterId, characters.id))
    .leftJoin(calligraphers, eq(calligraphyImages.calligrapherId, calligraphers.id))
    .leftJoin(works, eq(calligraphyImages.workId, works.id))
    .innerJoin(scriptStyles, eq(calligraphyImages.styleId, scriptStyles.id))
    .where(eq(calligraphyImages.workId, workId))
    .orderBy(orderExpr, calligraphyImages.id)
    .limit(limit + 1)
    .offset(offset)
    .all();

  return {
    images: rows.slice(0, limit),
    hasMore: rows.length > limit,
  };
}

/**
 * Returns all calligraphers and works with total image counts for the
 * browse sidebar — no character filter, just global totals.
 */
export function getBrowseFilters() {
  const calligrapherRows = db
    .select({
      id: calligraphers.id,
      nameZh: calligraphers.nameZh,
      dynasty: calligraphers.dynasty,
      imageCount: count(calligraphyImages.id),
    })
    .from(calligraphers)
    .innerJoin(calligraphyImages, eq(calligraphyImages.calligrapherId, calligraphers.id))
    .groupBy(calligraphers.id)
    .orderBy(desc(count(calligraphyImages.id)))
    .all();

  const workRows = db
    .select({
      id: works.id,
      nameZh: works.nameZh,
      imageCount: count(calligraphyImages.id),
    })
    .from(works)
    .innerJoin(calligraphyImages, eq(calligraphyImages.workId, works.id))
    .groupBy(works.id)
    .orderBy(desc(count(calligraphyImages.id)))
    .all();

  return {
    calligraphers: calligrapherRows.map((r) => ({
      ...r,
      imageCount: Number(r.imageCount),
    })),
    works: workRows.map((r) => ({
      ...r,
      imageCount: Number(r.imageCount),
    })),
  };
}