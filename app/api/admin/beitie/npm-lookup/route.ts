import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface WorkEntry {
  identifier: string;
  name: string;
  category: string;
  calligrapher: string | null;
  era: string;
  styleSlug: string | null;
  sourceUrl: string;
  imageUrl: string;
  imagePages: string[];
  iiifPages?: string[];
  shiwen?: string | null;
}

const INDEX_PATH = path.resolve(process.cwd(), "pipeline/data/works_index.json");

function loadIndex(): Record<string, WorkEntry> {
  if (!fs.existsSync(INDEX_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";

  const index = loadIndex();
  const all = Object.values(index) as WorkEntry[];

  let results: WorkEntry[];

  if (id) {
    const match = index[id];
    results = match ? [match] : [];
  } else if (q) {
    results = all.filter((w) => {
      const haystack = [w.identifier, w.name, w.calligrapher ?? ""].join(" ").toLowerCase();
      return haystack.includes(q);
    }).slice(0, 20);
  } else {
    results = [];
  }

  return NextResponse.json({
    results: results.map((w) => {
      // imagePages[] populated by fetch_pages.py; may be empty for un-scraped works
      // imageUrl is medium quality (imageUrl_m from NPM API)
      // TODO: investigate NPM high-res URL pattern for the 6MB variant
      const pageUrls = w.imagePages?.length ? w.imagePages : (w.iiifPages?.length ? w.iiifPages : []);
      const pageCount = pageUrls.length || (w.imageUrl ? 1 : 0);
      return {
        identifier: w.identifier,
        name: w.name,
        category: w.category,
        calligrapher: w.calligrapher ?? "",
        era: w.era ?? "",
        styleSlug: w.styleSlug ?? "",
        sourceUrl: w.sourceUrl ?? "",
        imageUrl: w.imageUrl ?? "",
        imagePages: pageUrls,
        pageCount,
        shiwen: w.shiwen ?? null,
      };
    }),
  });
}
