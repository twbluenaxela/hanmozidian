# STYLE.md — 書法字典 Design System

> Unified visual language for 書法字典. All UI work should follow these decisions. The goal is a dark, minimal canvas where calligraphic characters can speak for themselves — gold is reserved as a single accent, never a base surface.

## Philosophy

- **More with less.** No decoration for its own sake. Every element earns its place.
- **The character is the hero.** UI chrome recedes; the calligraphy image is what the user came for.
- **Gold is an accent, not a theme.** It marks active state, focus, and primary actions only. Flooding the page with gold dilutes it.

---

## Color Palette

### Surfaces
| Token | Value | Use |
|-------|-------|-----|
| Background | `#000000` | Page background — pure black, no warm tint |
| Card | `#0f0f0f` | Card/panel backgrounds |
| Card hover | `#1a1a1a` | Card hover state |
| Border | `#262626` | Default borders and dividers |

### Text
| Token | Value | Use |
|-------|-------|-----|
| Foreground | `#e5e5e5` | Primary text (neutral-200) |
| Muted | `#737373` | Secondary/supporting text (neutral-500) |
| Muted dim | `#525252` | Tertiary text, disabled states (neutral-600) |

### Gold Accent — use sparingly
| Token | Value | Use |
|-------|-------|-----|
| `--accent` | `#d4a853` | Active tab underlines, focus rings, primary CTAs, display title |
| `--accent-bright` | `#f0c56e` | Key CTAs that need to pop (e.g. submit buttons) |
| `--accent-dim` | `#6b5322` | Subtle gold borders, aged/muted accent use |

**Never use gold as a background surface.** It's a highlight, not a fill.

---

## Typography

### Display face (Chinese headings)
```
font-family: var(--font-noto-serif-tc), "Songti TC", "STSong", "SimSun", serif
```
- Used for: the 書法字典 title, character display, section headings with Chinese text
- Weight: 700–900 for titles, 400–600 for body Chinese
- Letter-spacing: `0.05em` default, `0.1em` for the main title

### UI face (labels, metadata)
```
font-family: Arial, Helvetica, sans-serif
```
- Used for: pill labels, subtitles in Latin script, metadata, small UI labels
- The subtitle "Chinese Calligraphy Dictionary" uses `letter-spacing: 0.35em`, `font-size: 9px`, `text-transform: uppercase`

### Scale reference
| Context | Size |
|---------|------|
| Main title (書法字典) | 34px |
| Section headings | 18–22px |
| Body / card text | 14–15px |
| Pill labels | 13px |
| Subtitle / metadata | 9–12px |

---

## Interactive Components

### Pills / Capsule Buttons
Idle state: translucent grey, low contrast — they should recede.
Hover state: gold border + gold text. Background does NOT change on hover.

```
idle:  background rgba(255,255,255,0.07)  border rgba(255,255,255,0.2)  color #aaa
hover: background rgba(255,255,255,0.07)  border #d4a853                color #d4a853
transition: all 0.15s
border-radius: 999px (full pill)
padding: 7px 14px
```

### Search Input
```
background: #111
border: 1px solid #3a3a3a  (idle)
border: 1px solid #d4a853  (focused)
box-shadow: 0 0 0 3px rgba(212,168,83,0.08)  (focused glow)
border-radius: 14px
caret-color: #d4a853
font: Noto Serif TC, 16px
text color: #e5e5e5
```

### Primary Action Button (查 / submit)
```
background: #d4a853
color: #000
font-weight: 700
border-radius: 8px
```

### Cards
```
background: #0f0f0f
border: 1px solid #262626
hover background: #1a1a1a
```

---

## Animation

### Page entry
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-up-1 { animation: fadeUp 0.6s ease both; }
.fade-up-2 { animation: fadeUp 0.6s ease both; animation-delay: 0.1s; }
```
Use staggered `fade-up-1` / `fade-up-2` for hero sections. Don't add more than 2 stagger levels.

### Animated placeholder characters
```css
@keyframes charEnter {
  from { opacity: 0; transform: translateY(calc(-50% - 10px)); }
  to   { opacity: 1; transform: translateY(-50%); }
}
@keyframes charExit {
  from { opacity: 1; transform: translateY(-50%); }
  to   { opacity: 0; transform: translateY(calc(-50% + 10px)); }
}
```
Characters slide in from above, exit downward. Cycle: 4s hold → 400ms exit → swap → 450ms enter → repeat.

### Transition defaults
- Color/border/shadow: `0.15s` (snappy)
- Border-color + box-shadow: `0.2s` (slightly softer for focus states)

---

## Icons

All icons are inline SVG, `stroke="currentColor"`, `fill="none"`, `strokeWidth` 1.3–1.6.
Standard size: 14×14px for pills/buttons, 22×22px for bottom nav.

Icons inherit `color` from their parent so hover/active states are automatic.

---

## Layout Principles

- Max content width: `max-w-sm` (384px) for centered single-column views
- Horizontal padding for text content: `px-6` (24px each side)
- Image galleries / full-bleed strips: no horizontal padding
- Bottom nav height: 64px (`pb-16` on body)
- Hero vertical offset: `paddingTop: 18vh` — keeps it above center, feels like a book opening

---

## Bottom Nav

4 items: 首頁, 碑帖, 瀏覽, 集字, (個人)
- Inactive: muted grey icon + label
- Active: gold (`#d4a853`) icon + label + accent underline (`box-shadow: inset 0 -2px 0 0 var(--accent)`)
- Icon size: 22×22px

---

## What NOT to do

- Don't use warm ivory or sepia tones on backgrounds — the palette is cool-neutral black
- Don't use gold as a fill color on large surfaces
- Don't add drop shadows unless needed for layering (e.g. modals)
- Don't use more than 2 font families
- Don't animate things that don't need to move
- Don't use `next/image` for the logo — use a plain `<img>` tag to bypass the optimization cache
