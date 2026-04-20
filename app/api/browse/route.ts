import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBrowseFilters, getGalleryImages, getWorkNameById } from "@/lib/db/queries";
import { resolveImageUrl } from "@/lib/utils";

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
// ID list parser
// ---------------------------------------------------------------------------

function parseIdList(raw: string | null): number[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
  return ids.length > 0 ? ids : undefined;
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
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  // ── Text-ordered mode: single work with corpus text ──────────────────────
  // Only applies when browsing a single work (not a calligrapher filter).
  if (workIds && workIds.length === 1 && !calligrapherIds) {
    const workName = getWorkNameById(workIds[0]);
    const piece = workName ? findCorpusPiece(workName) : null;

    if (piece) {
      // Fetch ALL images for this work (bounded by corpus size, safe to load)
      const allImages = getGalleryImages({ workIds, all: true });
      const processed = allImages.map((img) => ({
        ...img,
        imageUrl: resolveImageUrl(img.imagePath),
      }));

      // Build char → rank map from corpus text
      const charOrder = charOrderFromText(piece.text);
      const rankMap = new Map(charOrder.map((ch, i) => [ch, i]));

      // Sort: chars in text first (by position), then remaining chars
      processed.sort((a, b) => {
        const ra = rankMap.has(a.character) ? rankMap.get(a.character)! : Infinity;
        const rb = rankMap.has(b.character) ? rankMap.get(b.character)! : Infinity;
        if (ra !== rb) return ra - rb;
        return a.id - b.id;
      });

      const offset = (page - 1) * limit;
      const slice = processed.slice(offset, offset + limit);

      return NextResponse.json({
        images: slice,
        page,
        limit,
        hasMore: offset + limit < processed.length,
        total: processed.length,
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
