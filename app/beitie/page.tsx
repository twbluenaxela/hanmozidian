"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BeitieItem {
  id: number;
  title: string;
  author: string;
  dynasty: string;
  style: string;
  styleSlug: string;
  yearLabel: string | null;
  summary: string | null;
  coverImage: string | null;
  tags: string[];
}

const STYLE_COLORS: Record<string, { bg: string; text: string }> = {
  kai:   { bg: "rgba(212,168,83,0.12)",   text: "#d4a853" },
  xing:  { bg: "rgba(100,180,255,0.12)",  text: "#64b4ff" },
  cao:   { bg: "rgba(180,130,255,0.12)",  text: "#b482ff" },
  li:    { bg: "rgba(100,220,160,0.12)",  text: "#64dca0" },
  zhuan: { bg: "rgba(255,140,100,0.12)",  text: "#ff8c64" },
};

const STYLE_FILTERS = [
  { key: "all",   label: "全部" },
  { key: "kai",   label: "楷書" },
  { key: "xing",  label: "行書" },
  { key: "li",    label: "隸書" },
  { key: "zhuan", label: "篆書" },
  { key: "cao",   label: "草書" },
];

function CoverPlaceholder({ item }: { item: BeitieItem }) {
  const s = STYLE_COLORS[item.styleSlug] ?? STYLE_COLORS.kai;
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "#0d0d0d" }}
    >
      <span
        className="font-display select-none"
        style={{ fontSize: 72, color: s.text, opacity: 0.25, lineHeight: 1 }}
      >
        {[...item.title][0]}
      </span>
    </div>
  );
}

export default function BeiitiePage() {
  const router = useRouter();
  const [items, setItems] = useState<BeitieItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("style", filter);
    fetch(`/api/beitie?${params}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  const visible = items.filter(
    (p) => !search || p.title.includes(search) || p.author.includes(search) || p.dynasty.includes(search)
  );

  return (
    <div className="flex flex-col min-h-full bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--card-bg)] border-b border-[var(--border)] px-4 py-4">
        <div className="flex items-baseline gap-4 mb-4">
          <h1 className="font-display text-2xl text-[var(--accent)]">碑帖</h1>
          <span className="text-xs text-[var(--muted)] tracking-widest uppercase">Calligraphy Works</span>
        </div>
        {/* Style filter */}
        <div className="flex gap-2 flex-wrap mb-3">
          {STYLE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-md text-xs transition-colors border ${
                filter === f.key
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索碑帖、作者、朝代…"
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* Count */}
      <div className="px-4 py-2 text-[10px] text-[var(--muted-dim)]">
        {loading ? "載入中…" : `${visible.length} 件碑帖`}
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm animate-pulse">載入中…</div>
        ) : visible.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm">無符合條件的碑帖</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {visible.map((item) => {
              const s = STYLE_COLORS[item.styleSlug] ?? STYLE_COLORS.kai;
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(`/beitie/${item.id}`)}
                  className="group text-left bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--accent)] transition-all hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]"
                >
                  {/* Cover */}
                  <div className="aspect-[3/4] overflow-hidden border-b border-[var(--border)]">
                    {item.coverImage ? (
                      <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <CoverPlaceholder item={item} />
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded"
                        style={{ background: s.bg, color: s.text }}
                      >
                        {item.style}
                      </span>
                      <span className="text-[10px] text-[var(--muted)]">{item.dynasty}</span>
                    </div>
                    <p className="font-display font-bold text-base leading-tight text-[var(--foreground)] mb-1">
                      {item.title}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{item.author}</p>
                    {item.summary && (
                      <p className="text-[11px] text-[var(--muted-dim)] mt-2 line-clamp-2 leading-relaxed">
                        {item.summary}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
