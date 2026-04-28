# AGENT.md — `app/me/page.tsx`

## Overview

The me page (`/me`) is a single client-side file with three distinct states:
1. **Loading** — spinner while Firebase resolves auth state
2. **Unauthenticated** — `AuthCard` handles sign-in / register / password reset
3. **Authenticated** — user profile header + tabbed content (favorites, saved jizi)

Everything is in one file. No sub-routes, no server components, no API calls from this page.

---

## Auth Architecture

Auth state comes from `useAuth()` in `lib/auth-context.tsx`, which wraps Firebase's `onAuthStateChanged`. The context exposes `{ user: User | null, loading: boolean }`.

**Admin detection** is client-side only, derived at render time:
```ts
const adminUids = new Set(
  (process.env.NEXT_PUBLIC_ADMIN_UIDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
);
const isAdmin = adminUids.has(user.uid);
```
`NEXT_PUBLIC_ADMIN_UIDS` is set in `.env.local` and baked into the client bundle at build time. It mirrors the server-side `ADMIN_UIDS` var (used by `lib/security/admin-auth.ts`). The two are independent — this client check is UI-only; it shows/hides the admin badge and dashboard button but does not gate any real access.

---

## Component Structure

```
MePage (default export)
├── loading spinner          — while auth resolves
├── AuthCard                 — unauthenticated path
│   ├── Google sign-in button
│   ├── email/password form  — mode: "signin" | "register" | "reset"
│   └── PasswordInput        — includes strength meter for register mode
└── authenticated profile
    ├── avatar (photo or initials fallback)
    ├── display name + ⚙️ Admin badge (admin only)
    ├── email
    ├── 管理後台 button (admin only) + sign-out link
    ├── tab bar: 收藏 | 集字作品
    ├── favorites grid       — from useFavorites(uid)
    └── saved jizi list      — from useSavedJizi(uid), each rendered as SavedJiziCard
```

`SavedJiziCard` is a local component (bottom of file). It handles thumbnail display, load-into-jizi-workshop, download, and delete with a two-tap confirm pattern.

---

## Key Decisions

**All auth modes in one component (`AuthCard`)** — sign-in, register, and password reset share the same email field and error area. Mode is local state (`"signin" | "register" | "reset"`). This avoids page navigation for a three-state flow where the user might bounce between modes.

**Popup-closed errors silently discarded** — `auth/popup-closed-by-user` and `auth/cancelled-popup-request` are intentionally not shown as errors. Closing the popup is a user action, not a failure.

**"User not found" treated as success on reset** — `sendPasswordResetEmail` swallows `auth/user-not-found` to prevent email enumeration. The UI shows the same "link sent" message regardless.

**Password minimum is 12, not 8** — Firebase's minimum is 6; the app enforces 12 client-side before calling Firebase. The strength meter has four states (`empty / short / fair / good`) keyed to crossing 0, 8, and 12 characters.

**Google photo URL rewriting** — `enlargeGooglePhoto` rewrites `=s96-c` → `=s200-c` in the Google photo URL. Without this, avatars appear blurry at the 80px display size.

**Jizi "load" uses sessionStorage bridge** — loading a saved jizi into the workshop writes a JSON blob to `sessionStorage[JIZI_LOAD_KEY]` then navigates to `/jizi`. The jizi page reads and clears this key on mount. This avoids URL length limits and keeps the URL clean.

**Two-tap delete on `SavedJiziCard`** — a `confirming` boolean gates the destructive action. The confirm state resets on any outside click via a `mousedown` listener on `document` (not `click`, to avoid race conditions with the confirm button itself).

---

## Data Sources

| Data | Hook | Backing store |
|------|------|---------------|
| Favorites | `useFavorites(uid)` | Firestore |
| Saved jizi | `useSavedJizi(uid)` | Firestore |
| Auth state | `useAuth()` | Firebase Auth |

Both Firestore hooks are reactive (real-time listeners). Neither requires an explicit refresh.

---

## What Is NOT Here

- No server actions or API routes — this page is purely client-side
- No pagination on favorites or jizi — both load the full list
- No editing of saved jizi metadata in-place — edit means "load into workshop"
- The admin pages themselves (`/admin`, `/admin/annotate`) have their own `AGENT.md` at `app/admin/AGENT.md`
