import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

// 1. Force the path to be absolute within the Docker container
// In Docker, your WORKDIR is /app. The DB is at /app/data/shufazidian.db
const dbPath = process.env.DATABASE_PATH || "/app/data/shufazidian.db";

// 2. Logging for Fly.io Logs (Crucial for debugging)
console.log("---------------------------------------");
console.log("🔍 DATABASE DIAGNOSTICS");
console.log("📍 Target Path:", dbPath);
console.log("📂 File Exists?", fs.existsSync(dbPath));
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log("⚖️ File Size:", (stats.size / 1024 / 1024).toFixed(2), "MB");
}
console.log("---------------------------------------");

const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });