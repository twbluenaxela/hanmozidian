"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface BeitieDetail {
  id: number;
  title: string;
  author: string;
  dynasty: string;
  style: string;
  styleSlug: string;
  yearLabel: string | null;
  medium: string | null;
  charCount: number | null;
  summary: string | null;
  tags: string[];
  coverImage: string | null;
  pages: string[];
  shiwen: string | null;
  sourceCredit: string | null;
  sourceUrl: string | null;
  aiHistory: string | null;
  aiBiography: string | null;
  aiStyle: string | null;
  aiInfluence: string | null;
  aiStories: string | null;
  aiPractice: string | null;
  aiGeneratedAt: string | null;
}

const STYLE_COLORS: Record<string, { bg: string; text: string }> = {
  kai:   { bg: "rgba(212,168,83,0.12)",   text: "#d4a853" },
  xing:  { bg: "rgba(100,180,255,0.12)",  text: "#64b4ff" },
  cao:   { bg: "rgba(180,130,255,0.12)",  text: "#b482ff" },
  li:    { bg: "rgba(100,220,160,0.12)",  text: "#64dca0" },
  zhuan: { bg: "rgba(255,140,100,0.12)",  text: "#ff8c64" },
};

const AI_TABS = [
  { key: "aiHistory",   label: "歷史背景" },
  { key: "aiBiography", label: "作者生平" },
  { key: "aiStyle",     label: "書法風格" },
  { key: "aiInfluence", label: "影響傳承" },
  { key: "aiStories",   label: "趣事典故" },
  { key: "aiPractice",  label: "臨摹建議" },
] as const;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;

function Prose({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed text-[var(--foreground)] space-y-4">
      {text.split("\n\n").map((para, i) => (
        <p key={i} dangerouslySetInnerHTML={{
          __html: para.replace(/\*\*(.*?)\*\*/g, "<strong class=\"text-[var(--accent)] font-semibold\">$1</strong>")
        }} />
      ))}
    </div>
  );
}

function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);

  // Scroll wheel zoom (desktop)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.001)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Pinch-to-zoom (mobile)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinchRef.current = { dist: dist(e.touches) };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const d = dist(e.touches);
      const scale = d / pinchRef.current.dist;
      pinchRef.current.dist = d;
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * scale)));
    };
    const onTouchEnd = () => { pinchRef.current = null; };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      onClick={onClose}
    >
      {/* Controls — tall enough for fingers (min 48px) */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-white/50">{Math.round(zoom * 100)}%</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
            className="w-11 h-11 rounded-xl bg-white/10 active:bg-white/25 transition-colors text-white text-xl flex items-center justify-center"
          >
            +
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-3 h-11 rounded-xl bg-white/10 active:bg-white/25 transition-colors text-white text-xs"
          >
            1:1
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
            className="w-11 h-11 rounded-xl bg-white/10 active:bg-white/25 transition-colors text-white text-xl flex items-center justify-center"
          >
            −
          </button>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-white/10 active:bg-white/25 transition-colors text-white/70 ml-1 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4"
        onClick={(e) => e.stopPropagation()}
        style={{ cursor: zoom > 1 ? "grab" : "zoom-out", touchAction: "pan-x pan-y" }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 0.1s ease",
            maxWidth: "100%",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

export default function BeitieDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [item, setItem] = useState<BeitieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<typeof AI_TABS[number]["key"]>("aiHistory");
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/beitie/${id}`)
      .then((r) => r.json())
      .then((d) => { setItem(d.item ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  // Keyboard left/right to navigate images (only when lightbox is closed)
  useEffect(() => {
    if (!item) return;
    const allImages = [item.coverImage, ...item.pages].filter(Boolean) as string[];
    if (allImages.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (lightboxOpen) return;
      if (e.key === "ArrowLeft") setActiveImg((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActiveImg((i) => Math.min(allImages.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, lightboxOpen]);

  // Drag-to-scroll on thumbnail strip
  useEffect(() => {
    const el = thumbnailStripRef.current;
    if (!el) return;
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasDragged = false;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      hasDragged = false;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      el.style.cursor = "grabbing";
    };
    const onMouseUp = () => { isDown = false; el.style.cursor = "grab"; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = x - startX;
      if (Math.abs(walk) > 4) hasDragged = true;
      el.scrollLeft = scrollLeft - walk;
    };
    // Suppress the click that fires after a drag so thumbnails don't misfire
    const onClickCapture = (e: MouseEvent) => {
      if (hasDragged) { e.stopPropagation(); hasDragged = false; }
    };

    el.style.cursor = "grab";
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseup", onMouseUp);
    // document mouseup catches releases outside the strip
    document.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [item]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-[var(--muted)] text-sm animate-pulse">
        載入中…
      </div>
    );
  }
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-[var(--muted)]">
        <p>找不到此碑帖</p>
        <button onClick={() => router.push("/beitie")} className="text-sm text-[var(--accent)]">← 返回</button>
      </div>
    );
  }

  const s = STYLE_COLORS[item.styleSlug] ?? STYLE_COLORS.kai;
  const allImages = [item.coverImage, ...item.pages].filter(Boolean) as string[];
  const activeContent = item[activeTab];

  return (
    <>
      {/* Lightbox */}
      {lightboxOpen && allImages[activeImg] && (
        <ImageLightbox
          src={allImages[activeImg]}
          alt={item.title}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className="flex flex-col min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card-bg)]">
          <button
            onClick={() => router.push("/beitie")}
            className="text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
          >
            ← 碑帖
          </button>
          <span className="text-[var(--border)]">/</span>
          <span className="font-display text-sm text-[var(--accent)] truncate">{item.title}</span>
        </div>

        {/* Single scrollable column */}
        <div className="flex-1 overflow-y-auto">
          {/* Title + badges */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-end gap-3 mb-3 flex-wrap">
              <h1
                className="font-display font-black text-4xl text-[var(--accent)]"
                style={{ textShadow: "0 0 32px rgba(212,168,83,0.15)" }}
              >
                {item.title}
              </h1>
              <span className="font-display text-lg text-[var(--muted)]">{item.author}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded" style={{ background: s.bg, color: s.text }}>
                {item.style}
              </span>
              <span className="text-xs px-2.5 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)] text-[var(--muted)]">
                {item.dynasty}{item.yearLabel ? ` · ${item.yearLabel}` : ""}
              </span>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative bg-[#060606] border-y border-[var(--border)] flex items-center justify-center group" style={{ minHeight: 240 }}>
            {allImages.length > 0 ? (
              <>
                <img
                  src={allImages[activeImg]}
                  alt={item.title}
                  onClick={() => setLightboxOpen(true)}
                  className="max-h-[55vh] w-full object-contain cursor-zoom-in"
                />
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setActiveImg((i) => Math.max(0, i - 1))}
                      disabled={activeImg === 0}
                      aria-label="上一頁"
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 hover:bg-black/75"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setActiveImg((i) => Math.min(allImages.length - 1, i + 1))}
                      disabled={activeImg === allImages.length - 1}
                      aria-label="下一頁"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 hover:bg-black/75"
                    >
                      ›
                    </button>
                    <span className="absolute bottom-2 right-3 text-[10px] text-white/40 select-none">
                      {activeImg + 1} / {allImages.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span
                className="font-display select-none"
                style={{ fontSize: 96, color: s.text, opacity: 0.15 }}
              >
                {[...item.title][0]}
              </span>
            )}
          </div>

          {/* Page thumbnail strip */}
          {allImages.length > 1 && (
            <div className="px-4 py-3 bg-[var(--card-bg)] border-b border-[var(--border)]">
              <p className="text-[10px] text-[var(--muted)] mb-2">分頁 · {allImages.length} 頁</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveImg((i) => Math.max(0, i - 1))}
                  disabled={activeImg === 0}
                  aria-label="上一頁"
                  className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors disabled:opacity-20"
                >
                  ‹
                </button>
                <div ref={thumbnailStripRef} className="flex gap-2 overflow-x-auto pb-1 select-none flex-1" style={{ scrollbarWidth: "none" }}>
                  {allImages.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      className="shrink-0 w-14 h-[4.5rem] rounded overflow-hidden border transition-all active:scale-95"
                      style={{
                        borderColor: activeImg === i ? "var(--accent)" : "var(--border)",
                        opacity: activeImg === i ? 1 : 0.5,
                      }}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setActiveImg((i) => Math.min(allImages.length - 1, i + 1))}
                  disabled={activeImg === allImages.length - 1}
                  aria-label="下一頁"
                  className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors disabled:opacity-20"
                >
                  ›
                </button>
              </div>
            </div>
          )}

          {/* Metadata + tags + source */}
          <div className="px-6 py-4 border-b border-[var(--border)] space-y-2">
            {[
              ["作者", item.author],
              ["朝代", item.dynasty],
              ["年代", item.yearLabel],
              ["書體", item.style],
              ["載體", item.medium],
              ["字數", item.charCount ? `${item.charCount} 字` : null],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between items-baseline border-b border-[var(--border)]/40 pb-1.5">
                  <span className="text-xs text-[var(--muted)]">{k}</span>
                  <span className="text-xs text-[var(--foreground)] font-medium">{v}</span>
                </div>
              ))}

            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded border"
                    style={{
                      background: "rgba(212,168,83,0.06)",
                      borderColor: "var(--accent-dim)",
                      color: "var(--accent-dim)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {item.sourceCredit && (
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs text-[var(--muted)]">來源</span>
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    {item.sourceCredit}
                  </a>
                ) : (
                  <span className="text-xs text-[var(--foreground)]">{item.sourceCredit}</span>
                )}
              </div>
            )}
          </div>

          {/* 釋文 */}
          {item.shiwen && (
            <details className="border-b border-[var(--border)] group">
              <summary className="px-6 py-3 text-xs text-[var(--muted)] cursor-pointer select-none hover:text-[var(--foreground)] transition-colors list-none flex items-center gap-2">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                釋文
              </summary>
              <div className="px-6 pb-4 text-sm font-display leading-loose text-[var(--foreground)] tracking-wider">
                {item.shiwen}
              </div>
            </details>
          )}

          {/* AI content */}
          {!item.aiGeneratedAt ? (
            <div className="flex flex-col items-center justify-center gap-3 text-[var(--muted)] py-16">
              <p className="text-sm">AI 解析尚未生成</p>
              <p className="text-xs text-[var(--muted-dim)]">請在管理後台輸入內容</p>
            </div>
          ) : (
            <div className="pb-20">
              {/* AI label */}
              <div className="flex items-center gap-2 px-6 pt-5 pb-3">
                <span
                  className="text-[10px] px-2.5 py-1 rounded-full border"
                  style={{ background: "rgba(212,168,83,0.08)", borderColor: "rgba(212,168,83,0.2)", color: "var(--accent)" }}
                >
                  ✦ AI 解析
                </span>
                <span className="text-[10px] text-[var(--muted-dim)]">由 AI 生成，僅供參考</span>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[var(--border)] px-6 overflow-x-auto">
                {AI_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className="shrink-0 py-2 px-3 text-xs transition-colors"
                    style={{
                      color: activeTab === tab.key ? "var(--accent)" : "var(--muted)",
                      borderBottom: activeTab === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
                      marginBottom: -1,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div key={activeTab} className="px-6 py-5">
                {activeContent ? (
                  <Prose text={activeContent} />
                ) : (
                  <p className="text-sm text-[var(--muted)]">此段落暫無內容</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
