import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

/**
 * PATH LOGIC
 * Locally: Use path.join(process.cwd(), 'data', 'shufazidian.db')
 * Fly.io Runtime: Use /app/data/shufazidian.db
 * Docker Build: Use a relative path to avoid "directory not found" errors
 */
const isFly = !!process.env.FLY_APP_NAME;
const dbPath = isFly 
  ? "/app/data/shufazidian.db" 
  : path.join(process.cwd(), "data", "shufazidian.db");

const dbDir = path.dirname(dbPath);

// Ensure the directory exists so better-sqlite3 doesn't throw a TypeError
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    // During build time on some systems, this might fail, 
    // we catch it so it doesn't stop the Next.js build.
  }
}

// Diagnostics for Fly.io logs
if (isFly) {
  console.log("---------------------------------------");
  console.log("🔍 DATABASE DIAGNOSTICS");
  console.log("📍 Target Path:", dbPath);
  console.log("📂 File Exists?", fs.existsSync(dbPath));
  console.log("---------------------------------------");
}

const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });