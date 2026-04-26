import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { isAllowedUpstreamUrl } from "@/lib/security/url-allowlist";

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline");
const PYTHON = path.resolve(process.cwd(), ".venv/bin/python3");
const DATA_DIR = path.join(PIPELINE_DIR, "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const INDEX_FILE = path.join(DATA_DIR, "works_index.json");
const IDENTIFIER_RE = /^[\p{L}\p{N}._-]{1,128}$/u;

function safeFilename(identifier: string) {
  return encodeURIComponent(identifier).replace(/%/g, "_");
}

function loadIndex(): Record<string, any> {
  if (!fs.existsSync(INDEX_FILE)) return {};
  return JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
}

async function ensureImageDownloaded(identifier: string): Promise<boolean> {
  const safe = safeFilename(identifier);
  const dest = path.resolve(RAW_DIR, `${safe}.jpg`);
  if (!dest.startsWith(RAW_DIR + path.sep)) return false;
  if (fs.existsSync(dest)) return true;

  const index = loadIndex();
  const imageUrl = index[identifier]?.imageUrl;
  if (!isAllowedUpstreamUrl(imageUrl)) return false;

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

  if (!IDENTIFIER_RE.test(identifier)) {
    return NextResponse.json({ error: "invalid identifier" }, { status: 400 });
  }

  const index = loadIndex();
  if (!index[identifier]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const downloaded = await ensureImageDownloaded(identifier);
  if (!downloaded) {
    return NextResponse.json({ error: "image download failed" }, { status: 502 });
  }

  const result = spawnSync(
    PYTHON,
    [path.join(PIPELINE_DIR, "process.py"), "--id", identifier],
    { cwd: PIPELINE_DIR, timeout: 180_000, encoding: "utf-8", env: { ...process.env, FLAGS_use_mkldnn: "0" } }
  );

  if (result.status !== 0) {
    const stderr = result.stderr || result.error?.message || "unknown error";
    return NextResponse.json({ error: stderr }, { status: 500 });
  }

  const safe = safeFilename(identifier);
  const processedDir = path.join(DATA_DIR, "processed");
  const boxesFile = path.resolve(processedDir, safe, "boxes.json");
  if (!boxesFile.startsWith(processedDir + path.sep)) {
    return NextResponse.json({ error: "invalid identifier" }, { status: 400 });
  }
  if (!fs.existsSync(boxesFile)) {
    return NextResponse.json({ error: "process.py ran but produced no output" }, { status: 500 });
  }

  const boxes = JSON.parse(fs.readFileSync(boxesFile, "utf-8"));
  return NextResponse.json({ ok: true, boxes });
}
