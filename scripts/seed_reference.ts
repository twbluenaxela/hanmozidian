import Database from "better-sqlite3";
import path from "path";

const dbPath =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "shufazidian.db");
const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Seed script styles
const styles = [
  { name_zh: "篆書", name_en: "Seal Script", slug: "zhuan", sort_order: 1 },
  { name_zh: "隸書", name_en: "Clerical Script", slug: "li", sort_order: 2 },
  { name_zh: "楷書", name_en: "Regular Script", slug: "kai", sort_order: 3 },
  { name_zh: "行書", name_en: "Running Script", slug: "xing", sort_order: 4 },
  { name_zh: "草書", name_en: "Cursive Script", slug: "cao", sort_order: 5 },
];

const insertStyle = sqlite.prepare(
  `INSERT OR IGNORE INTO script_styles (name_zh, name_en, slug, sort_order) VALUES (?, ?, ?, ?)`
);

for (const s of styles) {
  insertStyle.run(s.name_zh, s.name_en, s.slug, s.sort_order);
}
console.log(`Seeded ${styles.length} script styles`);

// Seed famous calligraphers
const calligraphersData = [
  // 秦
  { name_zh: "李斯", name_en: "Li Si", dynasty: "秦" },
  // 漢
  { name_zh: "史晨", name_en: "Shi Chen", dynasty: "漢" },
  { name_zh: "曹全", name_en: "Cao Quan", dynasty: "漢" },
  { name_zh: "張遷", name_en: "Zhang Qian", dynasty: "漢" },
  // 晉
  { name_zh: "王羲之", name_en: "Wang Xizhi", dynasty: "晉" },
  { name_zh: "王獻之", name_en: "Wang Xianzhi", dynasty: "晉" },
  // 唐
  { name_zh: "歐陽詢", name_en: "Ouyang Xun", dynasty: "唐" },
  { name_zh: "顏真卿", name_en: "Yan Zhenqing", dynasty: "唐" },
  { name_zh: "柳公權", name_en: "Liu Gongquan", dynasty: "唐" },
  { name_zh: "褚遂良", name_en: "Chu Suiliang", dynasty: "唐" },
  { name_zh: "張旭", name_en: "Zhang Xu", dynasty: "唐" },
  { name_zh: "懷素", name_en: "Huai Su", dynasty: "唐" },
  { name_zh: "虞世南", name_en: "Yu Shinan", dynasty: "唐" },
  // 宋
  { name_zh: "蘇軾", name_en: "Su Shi", dynasty: "宋" },
  { name_zh: "黃庭堅", name_en: "Huang Tingjian", dynasty: "宋" },
  { name_zh: "米芾", name_en: "Mi Fu", dynasty: "宋" },
  { name_zh: "蔡襄", name_en: "Cai Xiang", dynasty: "宋" },
  // 元
  { name_zh: "趙孟頫", name_en: "Zhao Mengfu", dynasty: "元" },
  // 明
  { name_zh: "文徵明", name_en: "Wen Zhengming", dynasty: "明" },
  { name_zh: "董其昌", name_en: "Dong Qichang", dynasty: "明" },
  { name_zh: "祝允明", name_en: "Zhu Yunming", dynasty: "明" },
  // 清
  { name_zh: "金農", name_en: "Jin Nong", dynasty: "清" },
  { name_zh: "鄧石如", name_en: "Deng Shiru", dynasty: "清" },
  { name_zh: "何紹基", name_en: "He Shaoji", dynasty: "清" },
  { name_zh: "吳昌碩", name_en: "Wu Changshuo", dynasty: "清" },
  { name_zh: "何震", name_en: "He Zhen", dynasty: "明" },
];

const insertCalligrapher = sqlite.prepare(
  `INSERT OR IGNORE INTO calligraphers (name_zh, name_en, dynasty) VALUES (?, ?, ?)`
);

for (const c of calligraphersData) {
  insertCalligrapher.run(c.name_zh, c.name_en, c.dynasty);
}
console.log(`Seeded ${calligraphersData.length} calligraphers`);

// Seed some famous works
const worksData = [
  { name_zh: "蘭亭序", calligrapher: "王羲之", style: "xing" },
  { name_zh: "祭姪文稿", calligrapher: "顏真卿", style: "xing" },
  { name_zh: "寒食帖", calligrapher: "蘇軾", style: "xing" },
  { name_zh: "九成宮醴泉銘", calligrapher: "歐陽詢", style: "kai" },
  { name_zh: "多寶塔碑", calligrapher: "顏真卿", style: "kai" },
  { name_zh: "玄秘塔碑", calligrapher: "柳公權", style: "kai" },
  { name_zh: "孔子廟堂碑", calligrapher: "虞世南", style: "kai" },
  { name_zh: "雁塔聖教序", calligrapher: "褚遂良", style: "kai" },
  { name_zh: "自敘帖", calligrapher: "懷素", style: "cao" },
  { name_zh: "古詩四帖", calligrapher: "張旭", style: "cao" },
  { name_zh: "曹全碑", calligrapher: "曹全", style: "li" },
  { name_zh: "張遷碑", calligrapher: "張遷", style: "li" },
  { name_zh: "史晨碑", calligrapher: "史晨", style: "li" },
  { name_zh: "膽巴碑", calligrapher: "趙孟頫", style: "kai" },
  { name_zh: "洛神賦", calligrapher: "趙孟頫", style: "xing" },
  { name_zh: "前赤壁賦", calligrapher: "蘇軾", style: "xing" },
  { name_zh: "松風閣詩帖", calligrapher: "黃庭堅", style: "xing" },
  { name_zh: "蜀素帖", calligrapher: "米芾", style: "xing" },
  { name_zh: "張表碑", calligrapher: "張遷", style: "li" },
];

const getCalligrapherId = sqlite.prepare(
  `SELECT id FROM calligraphers WHERE name_zh = ?`
);
const getStyleId = sqlite.prepare(
  `SELECT id FROM script_styles WHERE slug = ?`
);
const insertWork = sqlite.prepare(
  `INSERT OR IGNORE INTO works (name_zh, calligrapher_id, style_id) VALUES (?, ?, ?)`
);

for (const w of worksData) {
  const calligrapher = getCalligrapherId.get(w.calligrapher) as
    | { id: number }
    | undefined;
  const style = getStyleId.get(w.style) as { id: number } | undefined;
  if (calligrapher && style) {
    insertWork.run(w.name_zh, calligrapher.id, style.id);
  }
}
console.log(`Seeded ${worksData.length} famous works`);

sqlite.close();
console.log("Done seeding reference data.");
