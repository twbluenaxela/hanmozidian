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
  coverImage: string | null;
  pages: string[];
  aiGeneratedAt: string | null;
  sourceCredit: string | null;
}

const STYLE_COLORS: Record<string, string> = {
  jinwen: "#e0be78",
  kai:    "#d4a853",
  xing:   "#64b4ff",
  cao:    "#b482ff",
  li:     "#64dca0",
  zhuan:  "#ff8c64",
};

export default function BeistieAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<BeitieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/beitie")
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleDelete(id: number, title: string) {
    if (!confirm(`刪除「${title}」？此操作不可復原。`)) return;
    setDeleting(id);
    await fetch(`/api/admin/beitie/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((it) => it.id !== id));
    setDeleting(null);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push("/admin")}
            className="text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors mb-2 block"
          >
            ← 管理後台
          </button>
          <h1 className="font-display text-2xl text-[var(--accent)]">碑帖管理</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">{items.length} 件碑帖</p>
        </div>
        <button
          onClick={() => router.push("/admin/beitie/add")}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          + 新增碑帖
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-[var(--muted)] py-12 animate-pulse">載入中…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-[var(--muted)] py-12">
          <p className="mb-4">尚無碑帖資料</p>
          <button
            onClick={() => router.push("/admin/beitie/add")}
            className="text-[var(--accent)] text-sm"
          >
            新增第一件碑帖 →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const color = STYLE_COLORS[item.styleSlug] ?? "#d4a853";
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-4 py-3"
              >
                {/* Thumbnail */}
                <div
                  className="w-12 h-16 rounded overflow-hidden shrink-0 border border-[var(--border)] flex items-center justify-center"
                  style={{ background: "#0d0d0d" }}
                >
                  {item.coverImage ? (
                    <img src={item.coverImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display text-xl" style={{ color, opacity: 0.4 }}>
                      {[...item.title][0]}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: `${color}18`, color }}
                    >
                      {item.style}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">{item.dynasty}</span>
                    <span className="text-[10px] text-[var(--muted)]">·</span>
                    <span className="text-[10px] text-[var(--muted)]">{item.pages.length + (item.coverImage ? 1 : 0)} 頁</span>
                  </div>
                  <p className="font-display font-bold text-sm truncate">{item.title}</p>
                  <p className="text-xs text-[var(--muted)]">{item.author}</p>
                </div>

                {/* AI status */}
                <div className="shrink-0 text-center">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      background: item.aiGeneratedAt ? "rgba(100,220,160,0.12)" : "rgba(120,120,120,0.1)",
                      color: item.aiGeneratedAt ? "#64dca0" : "#737373",
                    }}
                  >
                    {item.aiGeneratedAt ? "✓ AI" : "✗ AI"}
                  </span>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex gap-2">
                  <button
                    onClick={() => router.push(`/admin/beitie/${item.id}/edit`)}
                    className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.title)}
                    disabled={deleting === item.id}
                    className="px-3 py-1.5 text-xs border border-red-900/40 rounded-lg text-red-400/70 hover:text-red-400 hover:border-red-400/50 transition-colors disabled:opacity-40"
                  >
                    {deleting === item.id ? "…" : "刪除"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
