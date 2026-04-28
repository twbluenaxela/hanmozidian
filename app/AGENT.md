# AGENT.md — Homepage (`app/page.tsx`)

Architecture and design decisions for the 書法字典 homepage.

## What this page does

Single entry point. The user arrives here to search for a character, or navigate to a section (碑帖, 集字, 瀏覽). Nothing else. It is intentionally minimal.

## Component structure

```
HomePage                        ← main client component
  AnimatedPlaceholder           ← cycling character in search
  Pill × 4                      ← shortcut nav buttons
```

All three are defined in `app/page.tsx` — no external component files. Keep it that way unless the components grow significantly.

## Key architectural decisions

### Client-only rendering (mounted guard)
```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);
if (!mounted) return <div className="min-h-full" />;
```
**Why:** Dark Reader (and similar browser extensions) inject `data-darkreader-*` attributes before React hydrates, causing hydration mismatches. Rendering an empty shell on the server and the full page only on the client eliminates the mismatch entirely.
**Do not remove this pattern** even if it seems unnecessary — it protects against extension-induced hydration errors.

### Plain `<img>` instead of `next/image`
```tsx
<img src="/logo.png" alt="" width={28} height={28}
  style={{ width: "100%", height: "100%", objectFit: "contain" }} />
```
**Why:** Next.js image optimization caches aggressively in memory during the dev server run. When `public/logo.png` is replaced, the `<Image>` component can continue serving the old version even after `.next/cache/images/` is cleared. A plain `<img>` tag reads directly from `public/` with no intermediate cache.

### `objectFit: "contain"` on logo
The logo container is 28×28px with `overflow: hidden`. `contain` ensures the full logo is visible. `cover` would crop it.

### `export const dynamic = "force-dynamic"`
Prevents Next.js from statically generating this page at build time. The homepage uses `useRouter` and client-only state, so static generation is inappropriate.

### IME composition handling
```tsx
const isComposing = useRef(false);
onCompositionStart={() => { isComposing.current = true; }}
onCompositionEnd={e => { isComposing.current = false; setQuery(e.currentTarget.value); }}
onKeyDown={e => { if (e.key === "Enter" && !isComposing.current) handleSearch(); }}
```
**Why:** On macOS/iOS Chinese input, pressing Enter to confirm a pinyin composition also fires the `keydown` Enter event. Without the `isComposing` guard, the user accidentally triggers a search mid-composition.

### Search takes first character only
```tsx
const char = [...(q ?? query)][0];
```
`[...string]` spread handles multi-byte Unicode (e.g. surrogate pairs). Only the first character is used — this is a character dictionary, not a word search.

---

## AnimatedPlaceholder

Cycles through `PLACEHOLDER_CHARS` every ~4.5 seconds (4s hold + 0.4s exit animation + 0.05s buffer).

- Visible only when the input is empty AND not focused
- The animated char slides in from above (`charEnter`) and exits downward (`charExit`)
- The question text "你想要查什麽字呢？" is static, always visible alongside the char
- Uses `key={char}` on the char span to re-trigger the CSS animation on each character change

**Do not convert to a CSS-only animation.** The randomized character selection requires JS.

---

## Pills

Four shortcuts: 讀帖 → `/beitie`, 集字 → `/jizi`, 瀏覽 → `/browse`, 隨機 → random character.

- 隨機 uses `href: "__random"` as a sentinel — not a real route. The `Pill` component checks for this and calls `onRandom()` instead of navigating.
- `ALL_CHARS` is the pool for random navigation. It's intentionally broader than `PLACEHOLDER_CHARS`.
- Pill hover: gold border + gold text only. Background stays the same (does not change on hover — this was an explicit design decision).

---

## CSS animations

Defined in `app/globals.css`:
- `charEnter` / `charExit` — for the animated placeholder
- `fadeUp` / `.fade-up-1` / `.fade-up-2` — for hero entry animation (0.1s stagger)

---

## Files touched by this feature

| File | Role |
|------|------|
| `app/page.tsx` | All homepage logic and UI |
| `app/globals.css` | Keyframe animations, `.fade-up-*` classes |
| `app/layout.tsx` | Noto Serif TC font loading, `suppressHydrationWarning` |
| `public/logo.png` | Homepage logo (also synced to `app/icon.png` for favicon) |
| `app/icon.png` | Next.js auto-detected favicon |

`app/icon.png` and `public/logo.png` should always be the same file. When updating the logo, copy the new file to both paths.
