import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export type WorkStatus = "pending" | "processing" | "annotating" | "done" | "skipped";

export const npmWorks = sqliteTable(
  "npm_works",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identifier: text("identifier").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    calligrapher: text("calligrapher"),
    era: text("era"),
    styleSlug: text("style_slug"),
    釋文: text("shiwen"),
    desc: text("desc"),
    sourceUrl: text("source_url"),
    imageUrl: text("image_url"),
    localImagePath: text("local_image_path"),
    status: text("status").notNull().default("pending"),
    annotationDraft: text("annotation_draft"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_npm_works_identifier").on(table.identifier),
    index("idx_npm_works_status").on(table.status),
    index("idx_npm_works_category").on(table.category),
  ]
);

export const npmCharacters = sqliteTable(
  "npm_characters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workId: integer("work_id").notNull().references(() => npmWorks.id),
    character: text("character").notNull(),
    sequenceIndex: integer("sequence_index").notNull(),
    bboxX: real("bbox_x").notNull(),
    bboxY: real("bbox_y").notNull(),
    bboxW: real("bbox_w").notNull(),
    bboxH: real("bbox_h").notNull(),
    pngUrl: text("png_url"),
    svgUrl: text("svg_url"),
    confidence: real("confidence"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_npm_chars_work").on(table.workId),
    index("idx_npm_chars_character").on(table.character),
    index("idx_npm_chars_work_seq").on(table.workId, table.sequenceIndex),
  ]
);
