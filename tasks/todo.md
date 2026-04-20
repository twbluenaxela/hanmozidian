# Auth System — Task List

## Phase 1 · Firebase Foundation

- [ ] **T1** Install firebase SDK (`npm install firebase`)
  - AC: `firebase` appears in `package.json` dependencies
  - Verify: `import { initializeApp } from 'firebase/app'` compiles without error

- [ ] **T2** Create `lib/firebase.ts`
  - Init Firebase app with env-var config (`NEXT_PUBLIC_FIREBASE_*`)
  - Export `auth` singleton (`getAuth(app)`) and `db` singleton (`getFirestore(app)`)
  - AC: both exports available; no error when imported in a server-safe context
  - Verify: `npm run build` passes

- [ ] **T3** Document required env vars in `.env.local.example`
  - `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`
  - AC: example file present; README updated with Firebase setup steps

> **CHECKPOINT A** — `lib/firebase.ts` importable, no console errors on page load

---

## Phase 2 · Auth State Layer

- [ ] **T4** Create `lib/auth-context.tsx`
  - `AuthContext` with `{ user: User | null, loading: boolean }`
  - `AuthProvider` subscribes to `onAuthStateChanged`, unsubscribes on unmount
  - Export `useAuth()` hook
  - AC: loading is `true` only until first Firebase response; hook types correct

- [ ] **T5** Wrap layout in `AuthProvider`
  - Modify `app/layout.tsx`: wrap `<main>` (not `<html>`) in `<AuthProvider>`
  - AC: existing pages (`/`, `/jizi`, `/character/[char]`) render without change
  - Verify: `npm test` — all existing tests still pass

> **CHECKPOINT B** — No layout regression; all existing tests green

---

## Phase 3 · 我的 Page — Google Sign-In

- [ ] **T6** Create `app/me/page.tsx` (client component)
  - Branch on `useAuth()`: loading spinner → signed-out UI → signed-in UI
  - Signed-out: "歡迎" heading + Google sign-in button (`signInWithPopup` + `GoogleAuthProvider`)
  - Signed-in: avatar, display name, email, sign-out button
  - AC: page renders at `/me` without errors in both states
  - Verify: Google popup → profile appears → sign out → sign-in UI returns

> **CHECKPOINT C** — Full Google sign-in round-trip confirmed in browser

---

## Phase 4 · 我的 Page — Email/Password Sign-In

- [ ] **T7** Add email/password form to `app/me/page.tsx`
  - Email input, password input, "登入" and "註冊" buttons
  - `signInWithEmailAndPassword` for login, `createUserWithEmailAndPassword` for register
  - Inline error messages for: wrong password, email not found, email already in use, weak password
  - AC: error codes map to readable messages (not raw Firebase strings)
  - Verify: register → sign in → sign out → sign in again

> **CHECKPOINT D** — Email/password round-trip works; error cases handled

---

## Phase 5 · Favorite Characters

- [ ] **T8** Create `lib/favorites.ts`
  - Firestore path: `users/{uid}/favorites/{imageId}`
  - `addFavorite(uid, image)` — writes `{ imageId, imagePath, character, styleSlug, calligrapherName, savedAt }`
  - `removeFavorite(uid, imageId)` — deletes doc
  - `useFavorites(uid)` — real-time listener via `onSnapshot`, returns `Favorite[]`
  - AC: add/remove persist across reloads; listener updates without full page refresh

- [ ] **T9** Create `components/FavoriteButton.tsx`
  - Heart icon toggle (filled / outlined)
  - Uses `useAuth()` to get uid; calls `addFavorite` / `removeFavorite`
  - Hidden (returns null) when user is signed out
  - AC: clicking toggles Firestore doc; optimistic UI update (no flicker)

- [ ] **T10** Add `FavoriteButton` to `ImageCard.tsx`
  - Position: top-right overlay on the image
  - AC: button appears only when signed in; existing card layout unchanged for signed-out users
  - Verify: `npm test` — `ImageCard` tests still pass

- [ ] **T11** Show favorites grid on `app/me/page.tsx`
  - Use `useFavorites(uid)` in the signed-in view
  - Render a grid of favorited images (reuse `ImageCard` or a minimal tile)
  - Empty state: "尚未收藏任何字" message
  - AC: grid updates in real time when user favorites/unfavorites on another tab

> **CHECKPOINT E** — Favorite toggle persists across reloads and sessions; grid updates in real time

---

## Dependencies

```
T1 → T2 → T3
T2 → T4 → T5
T5 → T6 → T7
T7 → T8 → T9 → T10 → T11
```

---

## Future

- 集字 saves: `users/{uid}/jizi/{id}` — serialize phrase + per-character calligrapher selections
- Password reset
- Account deletion
