import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline", "data");
const INDEX_FILE = path.join(PIPELINE_DIR, "works_index.json");
const PROCESSED_DIR = path.join(PIPELINE_DIR, "processed");

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
  const index = loadIndex();
  const entry = index[identifier];
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

  const boxesFile = path.join(PROCESSED_DIR, identifier, "boxes.json");
  let boxes = null;
  if (fs.existsSync(boxesFile)) {
    boxes = JSON.parse(fs.readFileSync(boxesFile, "utf-8"));
  }

  return NextResponse.json({ work: entry, boxes });
}
