import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

// process.cwd() is /app in the Docker container and the project root locally.
// This is more reliable than hardcoding /app/
const dbPath = path.resolve(process.cwd(), "data", "hanmodict.db");
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Diagnostics for the Fly.io Logs
console.log(`[DB] Initialization. Path: ${dbPath}`);
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log(`[DB] File found. Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} else {
  console.log(`[DB] WARNING: Database file NOT found at build/start. A new empty DB will be created.`);
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };