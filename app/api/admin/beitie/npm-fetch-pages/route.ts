import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface WorkEntry {
  sourceUrl: string;
  imagePages?: string[];
  iiifPages?: string[];
  [key: string]: unknown;
}

const INDEX_PATH = path.resolve(process.cwd(), "pipeline/data/works_index.json");
const NPM_BASE = "https://digitalarchive.npm.gov.tw";
const UA = "HanmodictResearch/1.0 (educational calligraphy dictionary)";

function loadIndex(): Record<string, WorkEntry> {
  if (!fs.existsSync(INDEX_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8")); }
  catch { return {}; }
}

function saveIndex(index: Record<string, WorkEntry>) {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
}

async function scrapeImagePages(sourceUrl: string): Promise<string[]> {
  const res = await fetch(sourceUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const html = await res.text();
  const matches = [...html.matchAll(/src="(\/Image\/GetImage\?imageId=\d+&randomCode=\d+)"/g)];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const [, p] of matches) {
    if (!seen.has(p)) { seen.add(p); unique.push(NPM_BASE + p); }
  }
  unique.reverse(); // NPM renders thumbnails last-to-first
  return unique;
}

async function fetchIiifPages(sourceUrl: string): Promise<string[]> {
  const cidMatch = sourceUrl.match(/\/Detail\/(\d+)/);
  if (!cidMatch) return [];
  const cid = cidMatch[1];
  const depMatch = sourceUrl.match(/[?&]dep=([A-Za-z])/);
  const dep = depMatch ? depMatch[1] : "P";

  const manifestUrl = `${NPM_BASE}/Integrate/GetJson?cid=${cid}&dept=${dep}&imageName=`;
  try {
    const res = await fetch(manifestUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    type Manifest = { sequences?: Array<{ canvases?: Array<{ images?: Array<{ resource?: { service?: { "@id"?: string } } }> }> }> };
    const manifest = await res.json() as Manifest;
    const urls: string[] = [];
    for (const canvas of manifest.sequences?.[0]?.canvases ?? []) {
      const serviceId = canvas.images?.[0]?.resource?.service?.["@id"];
      if (serviceId) urls.push(`${serviceId}/full/full/0/default.jpg`);
    }
    return urls;
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  let id: string;
  try {
    const body = await request.json();
    id = body.id;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const index = loadIndex();
  const entry = index[id];
  if (!entry) return NextResponse.json({ error: "Not found in works index" }, { status: 404 });

  const [imagePages, iiifPages] = await Promise.all([
    scrapeImagePages(entry.sourceUrl),
    fetchIiifPages(entry.sourceUrl),
  ]);

  if (imagePages.length > 0) entry.imagePages = imagePages;
  if (iiifPages.length > 0) entry.iiifPages = iiifPages;
  if (imagePages.length > 0 || iiifPages.length > 0) saveIndex(index);

  const pageUrls = imagePages.length ? imagePages : iiifPages;
  return NextResponse.json({ imagePages, iiifPages, pageUrls, pageCount: pageUrls.length });
}
