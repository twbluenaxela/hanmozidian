# Auth System Plan — 我的 Page (Firebase)

## Goal

Add a Firebase-authenticated 我的 (My) page at `/me`. Users can sign in with Google or email/password, see their profile, and sign out. After auth is stable, users can favorite individual calligraphy images — stored in Firestore. 集字 creation saves are a planned future phase for deeper Firestore practice.

## Assumptions

1. Firebase project will be created by the user in the Firebase Console (we wire up the config).
2. Both Firebase Auth and Firestore are enabled in the project.
3. Favorites are stored in Firestore at `users/{uid}/favorites/{imageId}`, where `imageId` matches the SQLite `calligraphy_images.id`.
4. Google sign-in is the primary path; email/password is secondary.
5. Auth state is client-side only. All existing API routes remain public (SQLite data is read-only reference data).
6. `AuthProvider` must be a client component — it wraps `children` inside `RootLayout`, not the `<html>` element.
7. No SQLite schema changes. Favorites live entirely in Firestore.

## Dependency Graph

```
Firebase SDK (firebase/app, firebase/auth, firebase/firestore)
    ↓
lib/firebase.ts — app + auth + db singletons
    ↓
lib/auth-context.tsx — AuthContext + AuthProvider (client)
    ↓
app/layout.tsx — wraps <main> in <AuthProvider>
    ↓
useAuth() hook
    ↓
app/me/page.tsx
    ├── <SignedOut>  → <GoogleSignInButton> + <EmailPasswordForm>
    └── <SignedIn>   → <UserProfile> + <SignOutButton> + <FavoritesList>
                                                              ↑
lib/favorites.ts — Firestore read/write helpers
    ↓
components/FavoriteButton.tsx — heart toggle, used in ImageCard
    ↓
ImageCard.tsx — shows FavoriteButton when user is signed in
```

## Vertical Slices

### Phase 1 — Firebase foundation (no UI)
Install SDK, create `lib/firebase.ts` exporting `auth` and `db` (Firestore). Add env vars.

### Phase 2 — Auth state layer
`AuthProvider` + `useAuth` hook. Wraps layout. Existing pages unaffected.

### Phase 3 — 我的 page: Google sign-in path
Minimal `/me` page. Google sign-in → profile → sign-out round-trip.

### Phase 4 — 我的 page: email/password path
Email/password form with inline error handling.

### Phase 5 — Favorite characters
`lib/favorites.ts` with `addFavorite` / `removeFavorite` / `useFavorites` hook (Firestore real-time listener). `FavoriteButton` component. Heart shown on `ImageCard` when signed in. Favorites grid on `/me`.

## Checkpoints

| Checkpoint | Gate |
|---|---|
| A — after Phase 1 | `lib/firebase.ts` importable, no console errors on page load |
| B — after Phase 2 | All existing tests still pass; no layout regression |
| C — after Phase 3 | Google sign-in round-trip works in browser |
| D — after Phase 4 | Email/password round-trip works; error cases handled |
| E — after Phase 5 | Favorite toggle persists across page reloads and sign-in sessions |

## Future (out of scope for now)

- 集字 creation saves — serialize phrase + per-character selections to Firestore (`users/{uid}/jizi/{id}`)
- Server-side session / middleware route protection
- Password reset flow
- Account deletion
- 碑帖 page
