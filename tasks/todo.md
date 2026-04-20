# Auth System — Task List

## Phase 1 · Firebase Foundation

- [x] **T1** Install firebase SDK (`npm install firebase`)
- [x] **T2** Create `lib/firebase.ts` — exports `auth` + `db` singletons
- [x] **T3** `.env.local.example` + README Firebase setup section

> **CHECKPOINT A** ✅

---

## Phase 2 · Auth State Layer

- [x] **T4** Create `lib/auth-context.tsx` — AuthProvider + useAuth hook
- [x] **T5** Wrap `app/layout.tsx` in AuthProvider

> **CHECKPOINT B** ✅ — 89 tests green, no regressions

---

## Phase 3 · 我的 Page — Google Sign-In

- [x] **T6** Create `app/me/page.tsx` — loading / signed-out / signed-in views, Google sign-in

> **CHECKPOINT C** ✅ — needs live Firebase project to verify in browser

---

## Phase 4 · 我的 Page — Email/Password Sign-In

- [x] **T7** Email/password form with 登入 + 註冊, inline error messages

> **CHECKPOINT D** ✅ — needs live Firebase project to verify in browser

---

## Phase 5 · Favorite Characters

- [x] **T8** `lib/favorites.ts` — addFavorite / removeFavorite / useFavorites (Firestore real-time)
- [x] **T9** `components/FavoriteButton.tsx` — heart toggle overlay
- [x] **T10** Wire FavoriteButton into ImageCard + ImageGrid
- [x] **T11** Favorites grid on `app/me/page.tsx`

> **CHECKPOINT E** ✅ — needs live Firebase project to verify persistence

---

## Final status: 101 tests passing, 0 type errors

---

## Future

- 集字 saves: `users/{uid}/jizi/{id}` — serialize phrase + per-character calligrapher selections
- Password reset
- Account deletion
