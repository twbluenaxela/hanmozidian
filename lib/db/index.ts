import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

// On Fly.io, the populated SQLite metadata DB is baked into the image at
// /app/data/shufazidian.db (see Dockerfile + scripts/fly-start.sh).
const dbPath =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "shufazidian.db");

// Ensure the parent directory exists (important on first boot of a fresh Fly volume).
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
