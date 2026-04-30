"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import DonatePill from "@/components/DonatePill";


export const dynamic = "force-dynamic";

const PLACEHOLDER_CHARS = "永和書法道龍山水風月春秋雲心墨松竹梅蘭壽福仁義禮智信".split("");

const ALL_CHARS = "永和天下書法道龍山水風月花春秋雲心墨雨石松竹梅蘭菊鶴鳳虎龜壽福德仁義禮智信忠孝悌廉恥".split("");

function AnimatedPlaceholder({ visible }: { visible: boolean }) {
  const [char, setChar] = useState(PLACEHOLDER_CHARS[0]);
  const [phase, setPhase] = useState<"hold" | "exit">("hold");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    const schedule = () => {
      timerRef.current = setTimeout(() => {
        setPhase("exit");
        timerRef.current = setTimeout(() => {
          setChar(PLACEHOLDER_CHARS[Math.floor(Math.random() * PLACEHOLDER_CHARS.length)]);
          setPhase("hold");
          schedule();
        }, 450);
      }, 4000);
    };
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <span
        key={char}
        style={{
          position: "absolute", left: 46, top: "50%",
          fontFamily: 'var(--font-noto-serif-tc), "Songti TC", serif',
          fontSize: 20, fontWeight: 700,
          color: "#e5e5e5",
          pointerEvents: "none", userSelect: "none",
          animation: phase === "exit"
            ? "charExit 0.4s ease forwards"
            : "charEnter 0.4s ease forwards",
        }}
      >
        {char}
      </span>
      <span style={{
        position: "absolute", left: 76, top: "50%", transform: "translateY(-50%)",
        fontFamily: 'var(--font-noto-serif-tc), "Songti TC", serif', fontSize: 14,
        color: "#888", pointerEvents: "none", userSelect: "none",
        letterSpacing: "0.04em",
      }}>
        你想要查什麽字呢？
      </span>
    </>
  );
}

const PILLS = [
  {
    label: "讀帖",
    href: "/beitie",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 8h6M8 12h6M8 16h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "集字",
    href: "/jizi",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: "瀏覽",
    href: "/browse",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "隨機",
    href: "__random",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M18 4h3v3M21 4l-5 5M18 20h3v-3M21 20l-5-5M3 8h3a4 4 0 014 4 4 4 0 004 4h3M3 16h2"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function Pill({ label, href, icon, onNavigate, onRandom }: {
  label: string;
  href: string;
  icon: React.ReactNode;
  onNavigate: (href: string) => void;
  onRandom: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => href === "__random" ? onRandom() : onNavigate(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "7px 14px",
        background: "rgba(255,255,255,0.07)",
        border: "1px solid", borderColor: hovered ? "#d4a853" : "rgba(255,255,255,0.2)",
        borderRadius: 999,
        cursor: "pointer",
        color: hovered ? "#d4a853" : "#aaa",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{
        fontFamily: 'var(--font-noto-serif-tc), "Songti TC", serif',
        fontSize: 13, letterSpacing: "0.03em",
      }}>{label}</span>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const isComposing = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSearch = useCallback((q?: string) => {
    const char = [...(q ?? query)][0];
    if (char) router.push(`/character/${encodeURIComponent(char)}`);
  }, [query, router]);

  const handleRandom = () => {
    const char = ALL_CHARS[Math.floor(Math.random() * ALL_CHARS.length)];
    router.push(`/character/${encodeURIComponent(char)}`);
  };

  if (!mounted) return <div className="min-h-full" />;

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 pb-20"
      style={{ paddingTop: "18vh" }}>
      <DonatePill />

      {/* ── HERO ── */}
      <div className="fade-up-1 flex flex-col items-center w-full max-w-sm">

        {/* Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28,
            borderRadius: 5,
            overflow: "hidden", flexShrink: 0, opacity: 0.85,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={28} height={28}
              style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-noto-serif-tc), "Songti TC", serif', fontWeight: 900,
            fontSize: 34, letterSpacing: "0.1em",
            color: "#d4a853", lineHeight: 1,
          }}>
            翰墨字典
          </h1>
        </div>

        <p style={{
          fontSize: 9, letterSpacing: "0.35em", color: "#e5e5e5",
          fontFamily: "Arial", textTransform: "uppercase",
          marginBottom: 36,
        }}>
          Chinese Calligraphy Dictionary
        </p>

        {/* ── Search ── */}
        <div style={{ position: "relative", width: "100%", marginBottom: 12 }}>
          {/* Search icon */}
          <svg style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            pointerEvents: "none", zIndex: 2,
          }} width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="#e5e5e5" strokeWidth="1.5" />
            <path d="M16.5 16.5L21 21" stroke="#e5e5e5" strokeWidth="1.5" strokeLinecap="round" />
          </svg>

          <AnimatedPlaceholder visible={!query && !focused} />

          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onCompositionStart={() => { isComposing.current = true; }}
            onCompositionEnd={e => { isComposing.current = false; setQuery(e.currentTarget.value); }}
            onKeyDown={e => { if (e.key === "Enter" && !isComposing.current) handleSearch(); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder=""
            style={{
              width: "100%",
              background: "#111",
              border: "1px solid",
              borderColor: focused ? "#d4a853" : "#3a3a3a",
              borderRadius: 14,
              padding: "14px 20px 14px 52px",
              fontSize: 16,
              color: "#e5e5e5",
              fontFamily: 'var(--font-noto-serif-tc), "Songti TC", serif',
              outline: "none",
              caretColor: "#d4a853",
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxShadow: focused ? "0 0 0 3px rgba(212,168,83,0.08)" : "none",
            }}
          />

          {query && (
            <button
              onClick={() => handleSearch()}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "#d4a853", border: "none", borderRadius: 8,
                padding: "6px 14px", fontSize: 12,
                fontFamily: 'var(--font-noto-serif-tc), "Songti TC", serif',
                color: "#000", cursor: "pointer", fontWeight: 700,
              }}
            >
              查
            </button>
          )}
        </div>

        {/* ── Pill shortcuts ── */}
        <div className="fade-up-2" style={{
          display: "flex", gap: 8, justifyContent: "center",
          marginTop: 10, flexWrap: "wrap",
        }}>
          {PILLS.map(p => (
            <Pill
              key={p.href}
              label={p.label}
              href={p.href}
              icon={p.icon}
              onNavigate={href => router.push(href)}
              onRandom={handleRandom}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
