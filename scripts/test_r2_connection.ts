/**
 * Quick connection test for Cloudflare R2.
 * Verifies credentials work by listing the bucket and uploading a small test object.
 *
 * Usage: npx tsx scripts/test_r2_connection.ts
 */
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { config } from "dotenv";
import path from "path";

// Load .env.local
config({ path: path.join(process.cwd(), ".env.local") });

const {
  R2_ENDPOINT,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("Missing R2 credentials in .env.local");
  process.exit(1);
}

console.log("Testing R2 connection...");
console.log(`  Endpoint: ${R2_ENDPOINT}`);
console.log(`  Bucket:   ${R2_BUCKET_NAME}`);
console.log(`  Public:   ${R2_PUBLIC_URL || "(not set)"}`);
console.log();

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  forcePathStyle: true, // R2 uses path-style addressing
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function main() {
  // 1. Check bucket exists / is accessible
  try {
    await s3.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME! }));
    console.log("✓ Bucket accessible");
  } catch (e) {
    console.error("✗ Cannot access bucket:", (e as Error).message);
    process.exit(1);
  }

  // 2. List some objects (may be empty, that's fine)
  try {
    const result = await s3.send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME!, MaxKeys: 5 })
    );
    console.log(
      `✓ Listed bucket — ${result.KeyCount || 0} object(s) currently in bucket`
    );
  } catch (e) {
    console.error("✗ Cannot list bucket:", (e as Error).message);
    process.exit(1);
  }

  // 3. Upload a test SVG
  const testKey = "test/hello.svg";
  const testBody = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#1a1a1a"/><text x="50" y="55" font-size="20" text-anchor="middle" fill="#d4a574">R2 OK</text></svg>`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME!,
        Key: testKey,
        Body: testBody,
        ContentType: "image/svg+xml",
      })
    );
    console.log(`✓ Uploaded test file: ${testKey}`);
  } catch (e) {
    console.error("✗ Upload failed:", (e as Error).message);
    process.exit(1);
  }

  console.log();
  if (R2_PUBLIC_URL) {
    console.log(`Public URL: ${R2_PUBLIC_URL}/${testKey}`);
    console.log("Try opening it in your browser to verify public access.");
  }

  console.log();
  console.log("All checks passed. R2 is ready for uploads.");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
