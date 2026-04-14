import { db } from "./index";
import {
  characters,
  scriptStyles,
  calligraphers,
  works,
  calligraphyImages,
} from "./schema";
import { eq, and, sql, count } from "drizzle-orm";

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
  calligrapherId?: number;
  workId?: number;
  page?: number;
  limit?: number;
  random?: boolean;
}) {
  const {
    characterId,
    styleSlug,
    calligrapherId,
    workId,
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

  if (calligrapherId) {
    conditions.push(eq(calligraphyImages.calligrapherId, calligrapherId));
  }

  if (workId) {
    conditions.push(eq(calligraphyImages.workId, workId));
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
