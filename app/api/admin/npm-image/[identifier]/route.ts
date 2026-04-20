import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline", "data");
const INDEX_FILE = path.join(PIPELINE_DIR, "works_index.json");

function safeFilename(identifier: string) {
  return encodeURIComponent(identifier).replace(/%/g, "_");
}

function loadIndex(): Record<string, any> {
  if (!fs.existsSync(INDEX_FILE)) return {};
  return JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await params;
  const type = req.nextUrl.searchParams.get("type") || "clean";
  const safe = safeFilename(identifier);

  const candidates = [
    path.join(PIPELINE_DIR, "processed", safe, `${type}.jpg`),
    path.join(PIPELINE_DIR, "processed", identifier, `${type}.jpg`),
    path.join(PIPELINE_DIR, "raw", `${safe}.jpg`),
    path.join(PIPELINE_DIR, "raw", `${identifier}.jpg`),
  ];

  const filePath = candidates.find((p) => fs.existsSync(p));

  if (filePath) {
    const buffer = fs.readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  }

  // Fallback: proxy from NPM if we have the imageUrl in index
  const index = loadIndex();
  const entry = index[identifier];
  if (entry?.imageUrl) {
    try {
      const upstream = await fetch(entry.imageUrl);
      if (upstream.ok) {
        const buffer = await upstream.arrayBuffer();
        // Cache locally for next time
        const localPath = path.join(PIPELINE_DIR, "raw", `${safe}.jpg`);
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        fs.writeFileSync(localPath, Buffer.from(buffer));
        return new NextResponse(buffer, {
          headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
        });
      }
    } catch {
      // fall through to 404
    }
  }

  return NextResponse.json({ error: "image not found" }, { status: 404 });
}
