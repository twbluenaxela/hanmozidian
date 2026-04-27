import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const INDEX_FILE = path.join(process.cwd(), "pipeline", "data", "works_index.json");
const PUBLIC_IMAGES = path.join(process.cwd(), "public", "images");
const IDENTIFIER_RE = /^[\p{L}\p{N}._-]{1,128}$/u;

// GET /api/admin/export/crops?id=<identifier>
// Returns the list of cropped image paths for a given work identifier.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id || !IDENTIFIER_RE.test(id)) {
    return NextResponse.json({ error: "missing or invalid id" }, { status: 400 });
  }

  if (!fs.existsSync(INDEX_FILE)) return NextResponse.json({ crops: [], styleSlug: null });
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
  const work = index[id];
  if (!work) return NextResponse.json({ error: "not found" }, { status: 404 });

  const styleSlug: string | null = work.styleSlug || null;
  if (!styleSlug) return NextResponse.json({ crops: [], styleSlug: null });

  const dir = path.join(PUBLIC_IMAGES, styleSlug);
  if (!fs.existsSync(dir)) return NextResponse.json({ crops: [], styleSlug });

  const marker = `_${id}_`;
  const crops = fs
    .readdirSync(dir)
    .filter((f) => f.includes(marker) && f.endsWith(".webp"))
    .sort((a, b) => {
      const idxA = parseInt(a.replace(".webp", "").split("_").pop() || "0", 10);
      const idxB = parseInt(b.replace(".webp", "").split("_").pop() || "0", 10);
      return idxA - idxB;
    })
    .map((f) => ({
      src: `/images/${styleSlug}/${f}`,
      char: [...f][0],  // first Unicode character of the filename
    }));

  return NextResponse.json({ crops, styleSlug, total: crops.length });
}
