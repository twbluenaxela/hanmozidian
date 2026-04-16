#!/usr/bin/env node
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const dbPath =
  process.env.DATABASE_PATH || path.join(projectRoot, "data", "shufazidian.db");

const migrationsDir = path.join(projectRoot, "drizzle");
const journalPath = path.join(migrationsDir, "meta", "_journal.json");

if (!fs.existsSync(journalPath)) {
  console.error(`No drizzle journal at ${journalPath} — nothing to migrate.`);
  process.exit(0);
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ensure migration table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS __fly_migrations (
    tag TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );
`);

const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const entries = (journal.entries || []).sort((a, b) => a.idx - b.idx);

// 🔥 FIX: detect broken state (DB exists but migration history empty)
const appliedRows = db.prepare("SELECT tag FROM __fly_migrations").all();
const applied = new Set(appliedRows.map((r) => r.tag));

const hasAnyUserTables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '__fly_%' LIMIT 1"
  )
  .get();

// 🧯 SELF-HEAL MODE
if (hasAnyUserTables && applied.size === 0) {
  console.log("⚠️ Detected existing DB but empty migration history. Repairing...");

  const repair = db.transaction(() => {
    for (const entry of entries) {
      db.prepare(
        "INSERT OR IGNORE INTO __fly_migrations (tag, applied_at) VALUES (?, ?)"
      ).run(entry.tag, Date.now());
    }
  });

  repair();

  console.log("✔ Migration state repaired. Skipping execution.");
  db.close();
  process.exit(0);
}

// normal migration flow
let ran = 0;

for (const entry of entries) {
  const tag = entry.tag;

  if (applied.has(tag)) continue;

  const sqlPath = path.join(migrationsDir, `${tag}.sql`);
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Migration file missing: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");

  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const applyTxn = db.transaction(() => {
    for (const stmt of statements) {
      db.exec(stmt);
    }

    db.prepare(
      "INSERT INTO __fly_migrations (tag, applied_at) VALUES (?, ?)"
    ).run(tag, Date.now());
  });

  console.log(`Applying migration: ${tag}`);
  applyTxn();
  ran++;
}

if (ran === 0) {
  console.log(`No pending migrations. (DB: ${dbPath})`);
} else {
  console.log(`Applied ${ran} migration(s). (DB: ${dbPath})`);
}

db.close();