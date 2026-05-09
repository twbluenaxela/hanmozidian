import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline");
const DATA_DIR = path.join(PIPELINE_DIR, "data");
const INDEX_FILE = path.join(DATA_DIR, "works_index.json");
const PROCESSED_DIR = path.join(DATA_DIR, "processed");
const PYTHON = path.resolve(process.cwd(), ".venv/bin/python3");

function loadIndex(): Record<string, any> {
  if (!fs.existsSync(INDEX_FILE)) return {};
  return JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
}

// GET /api/admin/npm/[identifier] — load work + boxes for annotation tool
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await params;
  let index = loadIndex();
  let entry = index[identifier];
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Auto-fetch image pages if not yet scraped
  if (!entry.imagePages?.length) {
    spawnSync(PYTHON, [path.join(PIPELINE_DIR, "fetch_pages.py"), "--id", identifier], {
      cwd: PIPELINE_DIR, timeout: 30_000, encoding: "utf-8",
    });
    index = loadIndex();
    entry = index[identifier] ?? entry;
  }

  const boxesFile = path.join(PROCESSED_DIR, identifier, "boxes.json");
  let boxes = null;
  if (fs.existsSync(boxesFile)) {
    boxes = JSON.parse(fs.readFileSync(boxesFile, "utf-8"));
  }

  const pageCount = entry.imagePages?.length ?? 1;
  return NextResponse.json({ work: entry, boxes, pageCount });
}
