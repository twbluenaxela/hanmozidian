// ─── ADD THIS ENTRY to components/BottomNav.tsx ──────────────────────────────
//
// Find the array of nav items in your BottomNav component and insert:
//
//   { href: "/beitie", label: "碑帖", icon: <BeijianIcon /> }
//
// ─── Example (adapt to your BottomNav's actual structure) ────────────────────

// The icon — a simple scroll/column glyph in SVG:
function BeijianIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      {/* Scroll shape */}
      <rect x="4" y="3" width="14" height="16" rx="2"
        stroke={active ? "#d4a853" : "#737373"} strokeWidth="1.4" />
      {/* Horizontal lines representing text */}
      <line x1="7" y1="8"  x2="15" y2="8"  stroke={active ? "#d4a853" : "#737373"} strokeWidth="1.1" strokeLinecap="round" />
      <line x1="7" y1="11" x2="15" y2="11" stroke={active ? "#d4a853" : "#737373"} strokeWidth="1.1" strokeLinecap="round" />
      <line x1="7" y1="14" x2="12" y2="14" stroke={active ? "#d4a853" : "#737373"} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

// ─── The nav item to add ─────────────────────────────────────────────────────
//
//  { href: "/beitie",  label: "碑帖",  Icon: BeijianIcon }
//
// Place it between 瀏覽 and 集字 (or wherever fits your tab order).
// ─────────────────────────────────────────────────────────────────────────────
