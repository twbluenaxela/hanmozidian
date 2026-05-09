import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const ROOT = path.resolve(process.cwd());

// POST /api/admin/deploy
// Fires ./deploy.sh in the background (does not wait for it to finish).
// Returns immediately so the UI is never blocked.
export async function POST() {
  const child = spawn("bash", [path.join(ROOT, "deploy.sh")], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return NextResponse.json({ ok: true, message: "deploy started" });
}
