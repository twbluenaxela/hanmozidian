import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function init() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey && projectId) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } else {
    initializeApp({ credential: applicationDefault(), projectId });
  }
}

function adminUids(): Set<string> {
  return new Set(
    (process.env.ADMIN_UIDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export async function verifyAdminToken(idToken: string | null | undefined): Promise<{ uid: string } | null> {
  if (!idToken) return null;
  init();
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    if (!adminUids().has(decoded.uid)) return null;
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

export function extractBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
