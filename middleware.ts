import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

function adminUids(): Set<string> {
  return new Set(
    (process.env.ADMIN_UIDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

async function verifyWithFirebase(idToken: string): Promise<string | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { users?: Array<{ localId?: string }> };
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith("/api/admin");
  const allowed = adminUids();

  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const cookieToken = req.cookies.get("fb_id_token")?.value;
  const idToken = bearer || cookieToken;

  let uid: string | null = null;
  if (idToken) uid = await verifyWithFirebase(idToken);

  const ok = uid !== null && allowed.has(uid);

  if (!ok) {
    if (isApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  const res = NextResponse.next();
  res.headers.set("x-admin-uid", uid!);
  return res;
}
