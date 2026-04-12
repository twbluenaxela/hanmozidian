import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const characters = sqliteTable(
  "characters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    character: text("character").notNull().unique(),
    unicodeHex: text("unicode_hex").notNull().unique(),
  },
  (table) => [index("idx_characters_char").on(table.character)]
);

export const scriptStyles = sqliteTable("script_styles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const calligraphers = sqliteTable(
  "calligraphers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nameZh: text("name_zh").notNull(),
    nameEn: text("name_en"),
    dynasty: text("dynasty"),
  },
  (table) => [index("idx_calligraphers_dynasty").on(table.dynasty)]
);

export const works = sqliteTable(
  "works",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nameZh: text("name_zh").notNull(),
    calligrapherId: integer("calligrapher_id").references(
      () => calligraphers.id
    ),
    styleId: integer("style_id").references(() => scriptStyles.id),
  },
  (table) => [
    index("idx_works_calligrapher").on(table.calligrapherId),
    index("idx_works_style").on(table.styleId),
  ]
);

export const calligraphyImages = sqliteTable(
  "calligraphy_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    characterId: integer("character_id")
      .notNull()
      .references(() => characters.id),
    styleId: integer("style_id")
      .notNull()
      .references(() => scriptStyles.id),
    calligrapherId: integer("calligrapher_id").references(
      () => calligraphers.id
    ),
    workId: integer("work_id").references(() => works.id),
    imagePath: text("image_path").notNull(),
    source: text("source"),
  },
  (table) => [
    index("idx_images_char_style").on(table.characterId, table.styleId),
    index("idx_images_char_style_calligrapher").on(
      table.characterId,
      table.styleId,
      table.calligrapherId
    ),
    index("idx_images_calligrapher").on(table.calligrapherId),
    index("idx_images_work").on(table.workId),
  ]
);
