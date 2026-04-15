import { db } from "./index";
import {
  characters,
  scriptStyles,
  calligraphers,
  works,
  calligraphyImages,
} from "./schema";
import { eq, and, sql, count, inArray } from "drizzle-orm";

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

export function getCharacterByChar(char: string) {
  return db
    .select()
    .from(characters)
    .where(eq(characters.character, char))
    .get();
}

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
    if (style) {
      conditions.push(eq(calligraphyImages.styleId, style.id));
    }
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