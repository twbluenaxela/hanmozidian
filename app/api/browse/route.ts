import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBrowseFilters, getGalleryImages, getGalleryImagesCorpusOrdered, getWorkNameById } from "@/lib/db/queries";
import { resolveImageUrl, parseIdList } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Corpus helpers
// ---------------------------------------------------------------------------

interface CorpusPiece {
  id: string;
  name_zh: string;
  calligrapher_zh: string | null;
  text: string;
}

let _corpus: CorpusPiece[] | null = null;

function loadCorpus(): CorpusPiece[] {
  if (_corpus) return _corpus;
  try {
    const p = path.join(process.cwd(), "data", "zitools", "corpus.json");
    const raw = fs.readFileSync(p, "utf-8");
    _corpus = JSON.parse(raw).pieces as CorpusPiece[];
  } catch {
    _corpus = [];
  }
  return _corpus;
}

/** Return unique CJK characters in first-seen order for a piece's text. */
function charOrderFromText(text: string): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const isCjk =
      (cp >= 0x4e00 && cp <= 0x9fff) ||   // CJK Unified
      (cp >= 0x3400 && cp <= 0x4dbf) ||   // Extension A
      (cp >= 0x20000 && cp <= 0x2a6df) || // Extension B
      (cp >= 0xf900 && cp <= 0xfaff);     // CJK Compatibility
    if (isCjk && !seen.has(ch)) {
      seen.add(ch);
      order.push(ch);
    }
  }
  return order;
}

/** Find a corpus piece whose name_zh matches (or contains) the work name. */
function findCorpusPiece(workName: string): CorpusPiece | null {
  const corpus = loadCorpus();
  // Exact match first
  let piece = corpus.find((p) => p.name_zh === workName);
  if (piece) return piece;
  // Substring — DB name "蘭亭序" ⊂ corpus "蘭亭集序"
  piece = corpus.find(
    (p) => p.name_zh.includes(workName) || workName.includes(p.name_zh)
  );
  return piece ?? null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // ?filters=1  → return calligrapher + work lists for the sidebar
  if (searchParams.get("filters") === "1") {
    const data = getBrowseFilters();
    return NextResponse.json(data);
  }

  const calligrapherIds = parseIdList(searchParams.get("calligrapher"));
  const workIds = parseIdList(searchParams.get("work"));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20") || 20), 50);

  // ── Text-ordered mode: single work with corpus text ──────────────────────
  // Only applies when browsing a single work (not a calligrapher filter).
  if (workIds && workIds.length === 1 && !calligrapherIds) {
    const workName = getWorkNameById(workIds[0]);
    const piece = workName ? findCorpusPiece(workName) : null;

    if (piece) {
      const charOrder = charOrderFromText(piece.text);
      const { images, hasMore } = getGalleryImagesCorpusOrdered({
        workId: workIds[0],
        charOrder,
        page,
        limit,
      });

      return NextResponse.json({
        images: images.map((img) => ({ ...img, imageUrl: resolveImageUrl(img.imagePath) })),
        page,
        limit,
        hasMore,
        corpusOrdered: true,
      });
    }
  }

  // ── Default mode: paginate directly from DB ───────────────────────────────
  const images = getGalleryImages({ calligrapherIds, workIds, page, limit });
  const processed = images.map((img) => ({
    ...img,
    imageUrl: resolveImageUrl(img.imagePath),
  }));

  return NextResponse.json({
    images: processed,
    page,
    limit,
    hasMore: images.length === limit,
    corpusOrdered: false,
  });
}
