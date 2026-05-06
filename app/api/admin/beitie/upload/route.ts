import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const MAGIC_BYTES: { mime: string; bytes: number[] }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png",  bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: "image/gif",  bytes: [0x47, 0x49, 0x46, 0x38] },
];

function detectImageType(buf: Buffer): string | null {
  for (const sig of MAGIC_BYTES) {
    if (sig.bytes.every((b, i) => buf[i] === b)) {
      // WebP has "WEBP" at bytes 8-11 in addition to the RIFF header
      if (sig.mime === "image/webp" && buf.slice(8, 12).toString("ascii") !== "WEBP") continue;
      return sig.mime;
    }
  }
  return null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").toLowerCase();
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart data" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const uploads: { key: string; url: string }[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large (max 20 MB): ${file.name}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const mime = detectImageType(buffer);
    if (!mime) {
      return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 400 });
    }

    const safeFilename = sanitizeFilename(file.name);
    const key = `beitie/${Date.now()}-${safeFilename}`;

    try {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mime,
      }));
      uploads.push({ key, url: `${PUBLIC_URL}/${key}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `R2 upload failed: ${msg}` }, { status: 500 });
    }
  }

  return NextResponse.json({ uploads });
}
