import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const INDEX_FILE = path.resolve(process.cwd(), "pipeline/data/works_index.json");
const TIMESTAMP_FILE = path.resolve(process.cwd(), "pipeline/data/last_deployed.txt");

export async function GET() {
  const lastDeployed = fs.existsSync(TIMESTAMP_FILE)
    ? fs.readFileSync(TIMESTAMP_FILE, "utf-8").trim()
    : null;

  const index: Record<string, any> = fs.existsSync(INDEX_FILE)
    ? JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"))
    : {};

  const pending = Object.values(index).filter((w) => {
    if (!w.uploadedAt) return false;
    if (!lastDeployed) return true;
    return w.uploadedAt > lastDeployed;
  }).length;

  return NextResponse.json({ pending, lastDeployed });
}
