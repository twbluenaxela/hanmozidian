import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline");
const PYTHON = path.resolve(process.cwd(), ".venv/bin/python3");
const INDEX_FILE = path.join(PIPELINE_DIR, "data", "works_index.json");
const IDENTIFIER_RE = /^[\p{L}\p{N}._-]{1,128}$/u;

function loadIndex(): Record<string, any> {
  if (!fs.existsSync(INDEX_FILE)) return {};
  return JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
}

function countUsableBoxes(draft: string | null): number {
  if (!draft) return 0;
  try {
    const d = JSON.parse(draft);
    return (d.boxes || []).filter((b: any) => b.char && b.char !== "□").length;
  } catch {
    return 0;
  }
}

// GET /api/admin/export?page=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const pageRaw = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = 20;

  const index = loadIndex();
  const pending = (Object.values(index) as any[]).filter(
    (w) => w.status === "done" && !w.uploaded
  );
  pending.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

  const total = pending.length;
  const totalChars = pending.reduce((acc, w) => acc + countUsableBoxes(w.annotationDraft), 0);
  const paginated = pending
    .slice((page - 1) * pageSize, page * pageSize)
    .map((w) => ({
      identifier: w.identifier,
      name: w.name,
      displayName: w.displayName || null,
      calligrapher: w.calligrapher || null,
      era: w.era || null,
      styleSlug: w.styleSlug || null,
      updatedAt: w.updatedAt || null,
      charCount: countUsableBoxes(w.annotationDraft),
    }));

  return NextResponse.json({ works: paginated, total, totalChars, page, pageSize });
}

// POST /api/admin/export  body: { id?: string, force?: boolean }
// force=true re-exports even if already uploaded (cleans up old files + DB rows first)
export async function POST(req: NextRequest) {
  let identifier: string | null = null;
  let force = false;
  try {
    const body = await req.json();
    if (body.id) {
      if (!IDENTIFIER_RE.test(body.id)) {
        return NextResponse.json({ error: "invalid identifier" }, { status: 400 });
      }
      identifier = body.id;
    }
    force = !!body.force;
  } catch { /* no body */ }

  const exportArgs = [path.join(PIPELINE_DIR, "export.py")];
  if (identifier) exportArgs.push("--id", identifier);
  if (force) exportArgs.push("--force");

  const result = spawnSync(PYTHON, exportArgs, {
    cwd: process.cwd(),
    timeout: 300_000,
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    const stderr = result.stderr || result.error?.message || "export.py failed";
    return NextResponse.json({ error: stderr, output: result.stdout }, { status: 500 });
  }

  return NextResponse.json({ ok: true, output: result.stdout });
}
