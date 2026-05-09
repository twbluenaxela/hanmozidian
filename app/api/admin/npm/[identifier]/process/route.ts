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

async function ensureImageDownloaded(identifier: string, page = 0): Promise<boolean> {
  const safe = safeFilename(identifier);
  const filename = page > 0 ? `${safe}_p${page}.jpg` : `${safe}.jpg`;
  const dest = path.resolve(RAW_DIR, filename);
  if (!dest.startsWith(RAW_DIR + path.sep)) return false;
  if (fs.existsSync(dest)) return true;

  const index = loadIndex();
  const entry = index[identifier];
  const imageUrl = page > 0 ? entry?.imagePages?.[page] : entry?.imageUrl;
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
// Body (optional JSON): { forceSplit?: boolean }
// Downloads the image (if needed) then runs process.py to detect columns + boxes.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await params;

  if (!IDENTIFIER_RE.test(identifier)) {
    return NextResponse.json({ error: "invalid identifier" }, { status: 400 });
  }

  let forceSplit = false;
  let closeKernel = 6;
  let splitRatio = 1.5;
  let noCrop = false;
  let imageOnly = false;
  let page = 0;
  try {
    const body = await req.json();
    forceSplit = body?.forceSplit === true;
    noCrop = body?.noCrop === true;
    imageOnly = body?.imageOnly === true;
    if (typeof body?.closeKernel === "number") closeKernel = Math.round(Math.min(15, Math.max(1, body.closeKernel)));
    if (typeof body?.splitRatio === "number") splitRatio = Math.min(2.5, Math.max(1.1, body.splitRatio));
    if (typeof body?.page === "number") page = Math.max(0, Math.min(999, Math.round(body.page)));
  } catch {
    // no body or not JSON — fine
  }

  const index = loadIndex();
  if (!index[identifier]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const downloaded = await ensureImageDownloaded(identifier, page);
  if (!downloaded) {
    return NextResponse.json({ error: "image download failed" }, { status: 502 });
  }

  const pyArgs = [path.join(PIPELINE_DIR, "process.py"), "--id", identifier,
    "--close-kernel", String(closeKernel),
    "--split-ratio", String(splitRatio),
  ];
  if (forceSplit) pyArgs.push("--force-split");
  if (noCrop) pyArgs.push("--no-crop");
  if (imageOnly) pyArgs.push("--image-only");
  if (page > 0) pyArgs.push("--page", String(page));

  const result = spawnSync(
    PYTHON,
    pyArgs,
    { cwd: PIPELINE_DIR, timeout: 180_000, encoding: "utf-8", env: { ...process.env, FLAGS_use_mkldnn: "0" } }
  );

  if (result.status !== 0) {
    const stderr = result.stderr || result.error?.message || "unknown error";
    return NextResponse.json({ error: stderr }, { status: 500 });
  }

  const safe = safeFilename(identifier);
  const processedDir = path.join(DATA_DIR, "processed");
  const safeWithPage = page > 0 ? `${safe}_p${page}` : safe;

  if (imageOnly) {
    const imageonlyFile = path.resolve(processedDir, safeWithPage, "imageonly.json");
    if (!imageonlyFile.startsWith(processedDir + path.sep)) {
      return NextResponse.json({ error: "invalid identifier" }, { status: 400 });
    }
    if (!fs.existsSync(imageonlyFile)) {
      return NextResponse.json({ error: "process.py produced no output" }, { status: 500 });
    }
    const data = JSON.parse(fs.readFileSync(imageonlyFile, "utf-8"));
    return NextResponse.json({ ok: true, imageOnly: true, imageSize: data.imageSize });
  }

  const boxesFile = path.resolve(processedDir, safeWithPage, "boxes.json");
  if (!boxesFile.startsWith(processedDir + path.sep)) {
    return NextResponse.json({ error: "invalid identifier" }, { status: 400 });
  }
  if (!fs.existsSync(boxesFile)) {
    return NextResponse.json({ error: "process.py ran but produced no output" }, { status: 500 });
  }

  const boxes = JSON.parse(fs.readFileSync(boxesFile, "utf-8"));
  return NextResponse.json({ ok: true, boxes });
}
