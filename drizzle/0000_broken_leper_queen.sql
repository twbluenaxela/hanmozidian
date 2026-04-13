CREATE TABLE `calligraphers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text,
	`dynasty` text
);
--> statement-breakpoint
CREATE INDEX `idx_calligraphers_dynasty` ON `calligraphers` (`dynasty`);--> statement-breakpoint
CREATE TABLE `calligraphy_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character_id` integer NOT NULL,
	`style_id` integer NOT NULL,
	`calligrapher_id` integer,
	`work_id` integer,
	`image_path` text NOT NULL,
	`source` text,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`style_id`) REFERENCES `script_styles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`calligrapher_id`) REFERENCES `calligraphers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_images_char_style` ON `calligraphy_images` (`character_id`,`style_id`);--> statement-breakpoint
CREATE INDEX `idx_images_char_style_calligrapher` ON `calligraphy_images` (`character_id`,`style_id`,`calligrapher_id`);--> statement-breakpoint
CREATE INDEX `idx_images_calligrapher` ON `calligraphy_images` (`calligrapher_id`);--> statement-breakpoint
CREATE INDEX `idx_images_work` ON `calligraphy_images` (`work_id`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character` text NOT NULL,
	`unicode_hex` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_character_unique` ON `characters` (`character`);--> statement-breakpoint
CREATE UNIQUE INDEX `characters_unicode_hex_unique` ON `characters` (`unicode_hex`);--> statement-breakpoint
CREATE INDEX `idx_characters_char` ON `characters` (`character`);--> statement-breakpoint
CREATE TABLE `script_styles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `script_styles_slug_unique` ON `script_styles` (`slug`);--> statement-breakpoint
CREATE TABLE `works` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_zh` text NOT NULL,
	`calligrapher_id` integer,
	`style_id` integer,
	FOREIGN KEY (`calligrapher_id`) REFERENCES `calligraphers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`style_id`) REFERENCES `script_styles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_works_calligrapher` ON `works` (`calligrapher_id`);--> statement-breakpoint
CREATE INDEX `idx_works_style` ON `works` (`style_id`);