"use client";

import { useEffect, useState } from "react";
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

export default function BeitieDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [item, setItem] = useState<BeitieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<typeof AI_TABS[number]["key"]>("aiHistory");
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/beitie/${id}`)
      .then((r) => r.json())
      .then((d) => { setItem(d.item ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

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
    <div className="flex flex-col h-[100dvh] bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card-bg)]">
        <button
          onClick={() => router.push("/beitie")}
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
        >
          ← 碑帖
        </button>
        <span className="text-[var(--border)]">/</span>
        <span className="font-display text-sm text-[var(--accent)]">{item.title}</span>
      </div>

      {/* Body — two columns on md+, stacked on mobile */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* LEFT: image + metadata */}
        <div className="md:w-[320px] md:shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-[var(--border)] overflow-y-auto">
          {/* Main image */}
          <div className="bg-[#060606] flex items-center justify-center" style={{ minHeight: 240 }}>
            {allImages.length > 0 ? (
              <img
                src={allImages[activeImg]}
                alt={item.title}
                className="max-h-72 md:max-h-96 object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-56 w-full">
                <span
                  className="font-display select-none"
                  style={{ fontSize: 96, color: s.text, opacity: 0.18 }}
                >
                  {[...item.title][0]}
                </span>
              </div>
            )}
          </div>

          {/* Page thumbnails */}
          {allImages.length > 1 && (
            <div className="px-3 py-3 border-t border-[var(--border)] bg-[var(--card-bg)]">
              <p className="text-[10px] text-[var(--muted)] mb-2">分頁 · {allImages.length} 頁</p>
              <div className="flex gap-2 overflow-x-auto">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className="shrink-0 w-10 h-14 rounded overflow-hidden border transition-all"
                    style={{
                      borderColor: activeImg === i ? "var(--accent)" : "var(--border)",
                      opacity: activeImg === i ? 1 : 0.5,
                    }}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="px-4 py-4 space-y-2 border-t border-[var(--border)]">
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
                <div key={k} className="flex justify-between items-baseline border-b border-[var(--border)]/50 pb-1.5">
                  <span className="text-xs text-[var(--muted)]">{k}</span>
                  <span className="text-xs text-[var(--foreground)] font-medium">{v}</span>
                </div>
              ))}

            {/* Tags */}
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
          </div>
        </div>

        {/* RIGHT: heading + AI tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Heading */}
          <div className="shrink-0 px-6 pt-6 pb-4 border-b border-[var(--border)]">
            <div className="flex items-end gap-4 mb-3">
              <h1 className="font-display font-black text-4xl text-[var(--accent)]"
                style={{ textShadow: "0 0 32px rgba(212,168,83,0.15)" }}>
                {item.title}
              </h1>
              <span className="font-display text-lg text-[var(--muted)] mb-1">{item.author}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-xs px-2.5 py-1 rounded" style={{ background: s.bg, color: s.text }}>
                {item.style}
              </span>
              <span className="text-xs px-2.5 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)] text-[var(--muted)]">
                {item.dynasty}{item.yearLabel ? ` · ${item.yearLabel}` : ""}
              </span>
            </div>
          </div>

          {/* AI content */}
          {!item.aiGeneratedAt ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
              <p className="text-sm">AI 解析尚未生成</p>
              <p className="text-xs text-[var(--muted-dim)]">請在管理後台觸發生成</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* AI label */}
              <div className="shrink-0 flex items-center gap-2 px-6 pt-4">
                <span className="text-[10px] px-2.5 py-1 rounded-full border"
                  style={{ background: "rgba(212,168,83,0.08)", borderColor: "rgba(212,168,83,0.2)", color: "var(--accent)" }}>
                  ✦ AI 解析
                </span>
                <span className="text-[10px] text-[var(--muted-dim)]">由 AI 生成，僅供參考</span>
              </div>

              {/* Tabs */}
              <div className="shrink-0 flex border-b border-[var(--border)] mt-3 px-6 overflow-x-auto">
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
              <div key={activeTab} className="flex-1 overflow-y-auto px-6 py-5">
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
    </div>
  );
}
