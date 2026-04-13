import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle at .next/standalone so the Docker
  // image doesn't need node_modules at runtime. Required for the Fly.io deploy.
  output: "standalone",
  // better-sqlite3 ships a native binding (.node) that @vercel/nft can miss
  // when it's only imported dynamically. Tell the tracer to always include it.
  // (better-sqlite3 is already in Next.js's auto serverExternalPackages list.)
  outputFileTracingIncludes: {
    "/*": ["node_modules/better-sqlite3/build/Release/*.node"],
  },
};

export default nextConfig;
