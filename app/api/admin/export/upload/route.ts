import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import path from "path";

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline");
const PYTHON = path.resolve(process.cwd(), ".venv/bin/python3");
const IDENTIFIER_RE = /^[\p{L}\p{N}._-]{1,128}$/u;

// POST /api/admin/export/upload  body: { id: string }
// Runs upload_work.py for a specific identifier (targeted overwrite, no full R2 listing).
export async function POST(req: NextRequest) {
  let identifier: string;
  try {
    const body = await req.json();
    identifier = body.id;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!identifier || !IDENTIFIER_RE.test(identifier)) {
    return NextResponse.json({ error: "invalid identifier" }, { status: 400 });
  }

  const result = spawnSync(
    PYTHON,
    [path.join(PIPELINE_DIR, "upload_work.py"), "--id", identifier],
    { cwd: process.cwd(), timeout: 120_000, encoding: "utf-8" }
  );

  if (result.status !== 0) {
    const stderr = result.stderr || result.error?.message || "upload_work.py failed";
    return NextResponse.json({ error: stderr, output: result.stdout }, { status: 500 });
  }

  return NextResponse.json({ ok: true, output: result.stdout });
}
