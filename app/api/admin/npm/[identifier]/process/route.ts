import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline");
const DATA_DIR = path.join(PIPELINE_DIR, "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const INDEX_FILE = path.join(DATA_DIR, "works_index.json");

function safeFilename(identifier: string) {
  return encodeURIComponent(identifier).replace(/%/g, "_");
}

function loadIndex(): Record<string, any> {
  if (!fs.existsSync(INDEX_FILE)) return {};
  return JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
}

async function ensureImageDownloaded(identifier: string): Promise<boolean> {
  const safe = safeFilename(identifier);
  const dest = path.join(RAW_DIR, `${safe}.jpg`);
  if (fs.existsSync(dest)) return true;

  const index = loadIndex();
  const imageUrl = index[identifier]?.imageUrl;
  if (!imageUrl) return false;

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.writeFileSync(dest, Buffer.from(buf));
    return true;
  } catch {
    return false;
  }
}

// POST /api/admin/npm/[identifier]/process
// Downloads the image (if needed) then runs process.py to detect columns + boxes.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await params;

  const index = loadIndex();
  if (!index[identifier]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const downloaded = await ensureImageDownloaded(identifier);
  if (!downloaded) {
    return NextResponse.json({ error: "image download failed" }, { status: 502 });
  }

  const result = spawnSync(
    "python3",
    [path.join(PIPELINE_DIR, "process.py"), "--id", identifier],
    { cwd: PIPELINE_DIR, timeout: 180_000, encoding: "utf-8" }
  );

  if (result.status !== 0) {
    const stderr = result.stderr || result.error?.message || "unknown error";
    return NextResponse.json({ error: stderr }, { status: 500 });
  }

  const safe = safeFilename(identifier);
  const boxesFile = path.join(DATA_DIR, "processed", safe, "boxes.json");
  if (!fs.existsSync(boxesFile)) {
    return NextResponse.json({ error: "process.py ran but produced no output" }, { status: 500 });
  }

  const boxes = JSON.parse(fs.readFileSync(boxesFile, "utf-8"));
  return NextResponse.json({ ok: true, boxes });
}
