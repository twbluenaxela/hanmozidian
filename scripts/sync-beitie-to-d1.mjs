import Database from "better-sqlite3";
import path from "path";

const accountId = process.env.CF_ACCOUNT_ID;
const apiToken = process.env.CF_API_TOKEN;
const databaseId = process.env.D1_DATABASE_ID;
const sourceDbPath = process.env.SOURCE_DB_PATH || path.resolve(process.cwd(), "data", "shufazidian.db");

if (!accountId || !apiToken || !databaseId) {
  console.error("Missing required env vars: CF_ACCOUNT_ID, CF_API_TOKEN, D1_DATABASE_ID");
  process.exit(1);
}

const db = new Database(sourceDbPath, { readonly: true });
const rows = db.prepare("SELECT * FROM beitie ORDER BY id").all();
db.close();

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

async function d1Query(sql, params = []) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  const data = await res.json();
  if (!res.ok || !data.success || !data.result?.[0]?.success) {
    console.error("D1 error:", JSON.stringify(data, null, 2));
    throw new Error(`D1 query failed: HTTP ${res.status}`);
  }
  return data.result[0].results || [];
}

async function syncRows() {
  await d1Query(`
    CREATE TABLE IF NOT EXISTS beitie (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      dynasty TEXT NOT NULL,
      style TEXT NOT NULL,
      style_slug TEXT NOT NULL,
      year_label TEXT,
      medium TEXT,
      char_count INTEGER,
      summary TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      cover_image TEXT,
      pages_json TEXT NOT NULL DEFAULT '[]',
      shiwen TEXT,
      source_credit TEXT,
      source_url TEXT,
      ai_history TEXT,
      ai_biography TEXT,
      ai_style TEXT,
      ai_influence TEXT,
      ai_stories TEXT,
      ai_practice TEXT,
      ai_generated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await d1Query("CREATE INDEX IF NOT EXISTS idx_beitie_style_slug ON beitie(style_slug)");
  await d1Query("CREATE INDEX IF NOT EXISTS idx_beitie_author ON beitie(author)");
  await d1Query("CREATE INDEX IF NOT EXISTS idx_beitie_dynasty ON beitie(dynasty)");

  console.log(`Syncing ${rows.length} beitie rows from ${sourceDbPath} to D1...`);
  let synced = 0;

  for (const row of rows) {
    await d1Query(
      `INSERT INTO beitie (
        id, title, author, dynasty, style, style_slug, year_label, medium, char_count,
        summary, tags, cover_image, pages_json, shiwen, source_credit, source_url,
        ai_history, ai_biography, ai_style, ai_influence, ai_stories, ai_practice,
        ai_generated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        author=excluded.author,
        dynasty=excluded.dynasty,
        style=excluded.style,
        style_slug=excluded.style_slug,
        year_label=excluded.year_label,
        medium=excluded.medium,
        char_count=excluded.char_count,
        summary=excluded.summary,
        tags=excluded.tags,
        cover_image=excluded.cover_image,
        pages_json=excluded.pages_json,
        shiwen=excluded.shiwen,
        source_credit=excluded.source_credit,
        source_url=excluded.source_url,
        ai_history=excluded.ai_history,
        ai_biography=excluded.ai_biography,
        ai_style=excluded.ai_style,
        ai_influence=excluded.ai_influence,
        ai_stories=excluded.ai_stories,
        ai_practice=excluded.ai_practice,
        ai_generated_at=excluded.ai_generated_at,
        created_at=excluded.created_at,
        updated_at=excluded.updated_at`,
      [
        row.id,
        row.title,
        row.author,
        row.dynasty,
        row.style,
        row.style_slug,
        row.year_label,
        row.medium,
        row.char_count,
        row.summary,
        row.tags,
        row.cover_image,
        row.pages_json,
        row.shiwen,
        row.source_credit,
        row.source_url,
        row.ai_history,
        row.ai_biography,
        row.ai_style,
        row.ai_influence,
        row.ai_stories,
        row.ai_practice,
        row.ai_generated_at,
        row.created_at,
        row.updated_at,
      ]
    );

    synced += 1;
    if (synced % 25 === 0 || synced === rows.length) {
      console.log(`Synced ${synced}/${rows.length}`);
    }
  }

  const countRows = await d1Query("SELECT COUNT(*) AS c FROM beitie");
  const remoteCount = countRows[0]?.c ?? "unknown";
  console.log(`Done. Remote beitie row count: ${remoteCount}`);
}

syncRows().catch((err) => {
  console.error(err);
  process.exit(1);
});
