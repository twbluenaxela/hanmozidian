import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline", "data");
const INDEX_FILE = path.join(PIPELINE_DIR, "works_index.json");

function loadIndex(): Record<string, any> {
  if (!fs.existsSync(INDEX_FILE)) return {};
  return JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
}

function saveIndex(index: Record<string, any>) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
}

// GET /api/admin/npm?status=pending&category=法書&q=蘭亭&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status");
  const categoryFilter = searchParams.get("category");
  const query = searchParams.get("q")?.trim().toLowerCase();
  const page = parseInt(searchParams.get("page") || "1");
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

  works.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

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
  const body = await req.json();
  const { identifier, status, annotationDraft, shiwen, styleSlug, calligrapher } = body;

  if (!identifier) return NextResponse.json({ error: "identifier required" }, { status: 400 });

  const index = loadIndex();
  const entry = index[identifier];
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (status !== undefined) entry.status = status;
  if (annotationDraft !== undefined) entry.annotationDraft = annotationDraft;
  if (shiwen !== undefined) entry.shiwen = shiwen;
  if (styleSlug !== undefined) entry.styleSlug = styleSlug;
  if (calligrapher !== undefined) entry.calligrapher = calligrapher;
  entry.updatedAt = new Date().toISOString();

  index[identifier] = entry;
  saveIndex(index);

  return NextResponse.json({ ok: true });
}
