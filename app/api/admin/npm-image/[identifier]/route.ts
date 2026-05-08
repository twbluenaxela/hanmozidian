import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAllowedUpstreamUrl } from "@/lib/security/url-allowlist";

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline", "data");
const INDEX_FILE = path.join(PIPELINE_DIR, "works_index.json");

function safeFilename(identifier: string) {
  return encodeURIComponent(identifier).replace(/%/g, "_");
}

function safeJoin(base: string, ...parts: string[]): string | null {
  const resolved = path.resolve(base, ...parts);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
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
  const rawType = req.nextUrl.searchParams.get("type") || "clean";
  const type = /^[a-z0-9_-]{1,32}$/i.test(rawType) ? rawType : "clean";
  const pageParam = req.nextUrl.searchParams.get("page");
  const pageIndex = pageParam !== null ? parseInt(pageParam, 10) : 0;
  if (!Number.isFinite(pageIndex) || pageIndex < 0 || pageIndex > 999) {
    return NextResponse.json({ error: "invalid page" }, { status: 400 });
  }
  const safe = safeFilename(identifier);

  const candidateSpecs: Array<string[]> =
    pageIndex > 0
      ? [
          ["processed", `${safe}_p${pageIndex}`, `${type}.jpg`],
          ["raw", `${safe}_p${pageIndex}.jpg`],
        ]
      : [
          ["processed", safe, `${type}.jpg`],
          ["raw", `${safe}.jpg`],
        ];

  const candidates = candidateSpecs
    .map((parts) => safeJoin(PIPELINE_DIR, ...parts))
    .filter((p): p is string => p !== null);

  const filePath = candidates.find((p) => fs.existsSync(p));

  if (filePath) {
    const buffer = fs.readFileSync(filePath);
    const isProcessed = filePath.includes(`${path.sep}processed${path.sep}`);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": isProcessed ? "no-store" : "private, max-age=3600",
      },
    });
  }

  const index = loadIndex();
  const entry = index[identifier];

  // Prefer full-resolution IIIF URLs; fall back to GetImage (600px) thumbnails.
  let upstreamUrl: string | undefined;
  if (entry?.iiifPages?.length > pageIndex) {
    upstreamUrl = entry.iiifPages[pageIndex];
  } else if (pageIndex > 0 && entry?.imagePages?.length > pageIndex) {
    upstreamUrl = entry.imagePages[pageIndex];
  } else if (pageIndex === 0) {
    upstreamUrl = entry?.imagePages?.[0] || entry?.imageUrl;
  }

  if (upstreamUrl && isAllowedUpstreamUrl(upstreamUrl)) {
    try {
      const upstream = await fetch(upstreamUrl);
      if (upstream.ok) {
        const buffer = await upstream.arrayBuffer();
        const cacheFilename = pageIndex > 0 ? `${safe}_p${pageIndex}.jpg` : `${safe}.jpg`;
        const localPath = safeJoin(PIPELINE_DIR, "raw", cacheFilename);
        if (localPath) {
          fs.mkdirSync(path.dirname(localPath), { recursive: true });
          fs.writeFileSync(localPath, Buffer.from(buffer));
        }
        return new NextResponse(buffer, {
          headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
        });
      }
    } catch {
      // fall through
    }
  }

  return NextResponse.json({ error: "image not found" }, { status: 404 });
}
