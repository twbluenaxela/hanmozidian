import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { z } from "zod";

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline", "data");
const INDEX_FILE = path.join(PIPELINE_DIR, "works_index.json");

const STATUSES = ["pending", "processing", "annotating", "done", "skipped"] as const;

const PatchSchema = z
  .object({
    identifier: z.string().min(1).max(128),
    status: z.enum(STATUSES).optional(),
    annotationDraft: z.string().max(500_000).nullable().optional(),
    shiwen: z.string().max(5000).nullable().optional(),
    styleSlug: z.string().max(100).nullable().optional(),
    calligrapher: z.string().max(100).nullable().optional(),
    displayName: z.string().max(200).nullable().optional(),
    sourceBlurb: z.string().max(500).nullable().optional(),
  })
  .strict();

function loadIndex(): Record<string, any> {
  if (!fs.existsSync(INDEX_FILE)) return {};
  return JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
}

function saveIndex(index: Record<string, any>) {
  // rename(2) is atomic on the same filesystem, so a crash mid-write leaves
  // the existing index intact rather than truncated.
  const tmp = `${INDEX_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2), "utf-8");
  fs.renameSync(tmp, INDEX_FILE);
}

// Serializes PATCH load/modify/save sequences so concurrent requests don't
// clobber each other's writes.
let writeQueue: Promise<unknown> = Promise.resolve();
function withWriteLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const next = writeQueue.then(() => fn());
  writeQueue = next.catch(() => {});
  return next;
}

// GET /api/admin/npm?status=pending&category=法書&q=蘭亭&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status");
  const categoryFilter = searchParams.get("category");
  const query = searchParams.get("q")?.trim().toLowerCase();
  const pageRaw = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = 30;

  const index = loadIndex();
  let works = Object.values(index) as any[];

  if (statusFilter) works = works.filter((w) => w.status === statusFilter);
  if (categoryFilter) works = works.filter((w) => w.category === categoryFilter);
  if (query) {
    works = works.filter((w) =>
      w.name?.toLowerCase().includes(query) ||
      w.identifier?.toLowerCase().includes(query) ||
      w.calligrapher?.toLowerCase().includes(query)
    );
  }

  works.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

  const total = works.length;
  const paginated = works.slice((page - 1) * pageSize, page * pageSize);

  const allWorks = Object.values(index) as any[];
  const statusCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const w of allWorks) {
    statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
    if (w.category) categoryCounts[w.category] = (categoryCounts[w.category] || 0) + 1;
  }

  return NextResponse.json({ works: paginated, total, statusCounts, categoryCounts, page, pageSize });
}

// PATCH /api/admin/npm — update a work's status or draft
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { identifier, status, annotationDraft, shiwen, styleSlug, calligrapher, displayName, sourceBlurb } = parsed.data;

  return withWriteLock(() => {
    const index = loadIndex();
    const entry = index[identifier];
    if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (status !== undefined) {
      entry.status = status;
      // Re-completing an already-uploaded work means the annotation changed — mark
      // it for re-export so export.py picks it up again without needing --force.
      if (status === "done" && entry.uploaded) {
        entry.uploaded = false;
      }
    }
    if (annotationDraft !== undefined) entry.annotationDraft = annotationDraft;
    if (shiwen !== undefined) entry.shiwen = shiwen;
    if (styleSlug !== undefined) entry.styleSlug = styleSlug;
    if (calligrapher !== undefined) entry.calligrapher = calligrapher;
    if (displayName !== undefined) entry.displayName = displayName;
    if (sourceBlurb !== undefined) entry.sourceBlurb = sourceBlurb;
    entry.updatedAt = new Date().toISOString();

    index[identifier] = entry;
    saveIndex(index);

    return NextResponse.json({ ok: true });
  });
}
