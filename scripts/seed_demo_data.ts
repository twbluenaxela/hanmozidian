/**
 * Seeds demo data so we can test the UI without real calligraphy images.
 * Uses placeholder SVG images generated on-the-fly.
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "shufazidian.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

function charToUnicodeHex(char: string): string {
  return char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
}

// Create placeholder image directory
const placeholderDir = path.join(process.cwd(), "public", "placeholder");
fs.mkdirSync(placeholderDir, { recursive: true });

// Generate a placeholder SVG for a character in a given style
function generatePlaceholderSVG(char: string, calligrapher: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#1a1a1a"/>
  <text x="128" y="140" font-size="120" text-anchor="middle" fill="#e5e5e5" font-family="serif">${char}</text>
  <text x="128" y="230" font-size="16" text-anchor="middle" fill="#888">${calligrapher}</text>
</svg>`;
}

// Demo characters
const demoChars = [
  "永", "和", "天", "下", "為", "公", "書", "法", "道", "德",
  "仁", "義", "禮", "智", "信", "龍", "鳳", "山", "水", "風",
  "花", "月", "雲", "雨", "雪", "春", "夏", "秋", "冬", "日",
  "嘗", "人", "大", "中", "國",
];

// Insert characters
const insertChar = sqlite.prepare(
  `INSERT OR IGNORE INTO characters (character, unicode_hex) VALUES (?, ?)`
);
for (const char of demoChars) {
  insertChar.run(char, charToUnicodeHex(char));
}
console.log(`Seeded ${demoChars.length} characters`);

// Get all styles and calligraphers
const styles = sqlite.prepare(`SELECT * FROM script_styles ORDER BY sort_order`).all() as Array<{
  id: number;
  name_zh: string;
  slug: string;
}>;
const allCalligraphers = sqlite.prepare(`SELECT * FROM calligraphers`).all() as Array<{
  id: number;
  name_zh: string;
  dynasty: string;
}>;

// Map calligraphers to styles they are known for
const calligrapherStyles: Record<string, string[]> = {
  "李斯": ["zhuan"],
  "史晨": ["li"],
  "曹全": ["li"],
  "張遷": ["li"],
  "王羲之": ["xing", "kai", "cao"],
  "王獻之": ["xing", "cao"],
  "歐陽詢": ["kai"],
  "顏真卿": ["kai", "xing"],
  "柳公權": ["kai"],
  "褚遂良": ["kai"],
  "張旭": ["cao"],
  "懷素": ["cao"],
  "虞世南": ["kai"],
  "蘇軾": ["xing", "kai"],
  "黃庭堅": ["xing", "cao"],
  "米芾": ["xing"],
  "蔡襄": ["kai", "xing"],
  "趙孟頫": ["kai", "xing", "li"],
  "文徵明": ["kai", "xing"],
  "董其昌": ["xing", "cao"],
  "祝允明": ["cao", "xing"],
  "金農": ["li", "kai"],
  "鄧石如": ["zhuan", "li"],
  "何紹基": ["kai", "xing"],
  "吳昌碩": ["zhuan"],
  "何震": ["zhuan"],
};

const insertImage = sqlite.prepare(
  `INSERT INTO calligraphy_images (character_id, style_id, calligrapher_id, work_id, image_path, source) VALUES (?, ?, ?, ?, ?, ?)`
);

const getCharId = sqlite.prepare(`SELECT id FROM characters WHERE character = ?`);
const getStyleBySlug = sqlite.prepare(`SELECT id FROM script_styles WHERE slug = ?`);

let imageCount = 0;

const insertBatch = sqlite.transaction(() => {
  for (const char of demoChars) {
    const charRow = getCharId.get(char) as { id: number } | undefined;
    if (!charRow) continue;

    for (const calligrapher of allCalligraphers) {
      const stylesSlugs = calligrapherStyles[calligrapher.name_zh];
      if (!stylesSlugs) continue;

      for (const slug of stylesSlugs) {
        const styleRow = getStyleBySlug.get(slug) as { id: number } | undefined;
        if (!styleRow) continue;

        // Generate and save placeholder
        const fileName = `${charToUnicodeHex(char)}_${calligrapher.id}_${styleRow.id}.svg`;
        const svgContent = generatePlaceholderSVG(char, calligrapher.name_zh);
        fs.writeFileSync(path.join(placeholderDir, fileName), svgContent);

        const imagePath = `placeholder/${fileName}`;
        insertImage.run(
          charRow.id,
          styleRow.id,
          calligrapher.id,
          null,
          imagePath,
          "demo"
        );
        imageCount++;
      }
    }
  }
});

insertBatch();
console.log(`Seeded ${imageCount} demo calligraphy images`);

sqlite.close();
console.log("Done seeding demo data.");
