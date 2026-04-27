"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type WorkStatus = "pending" | "processing" | "annotating" | "done" | "skipped";

interface Work {
  identifier: string;
  name: string;
  displayName?: string | null;
  category: string;
  calligrapher: string | null;
  era: string;
  styleSlug: string | null;
  shiwen: string | null;
  status: WorkStatus;
  updatedAt: string;
}

const STATUS_LABELS: Record<WorkStatus, string> = {
  pending: "待處理",
  processing: "已分析",
  annotating: "標注中",
  done: "完成",
  skipped: "略過",
};

const STATUS_COLORS: Record<WorkStatus, string> = {
  pending: "bg-[var(--muted)]/20 text-[var(--muted)]",
  processing: "bg-blue-500/20 text-blue-400",
  annotating: "bg-yellow-500/20 text-yellow-400",
  done: "bg-green-500/20 text-green-400",
  skipped: "bg-red-500/20 text-red-400",
};

const ALL_STATUSES: WorkStatus[] = ["pending", "processing", "annotating", "done", "skipped"];

export default function AdminPage() {
  const router = useRouter();
  const [works, setWorks] = useState<Work[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [activeStatus, setActiveStatus] = useState<WorkStatus | "all">("all");
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce so search doesn't fire a request on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (activeStatus !== "all") params.set("status", activeStatus);
    if (activeCategory !== "all") params.set("category", activeCategory);
    if (debouncedQuery) params.set("q", debouncedQuery);
    fetch(`/api/admin/npm?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setWorks(data.works || []);
        setStatusCounts(data.statusCounts || {});
        setCategoryCounts(data.categoryCounts || {});
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError("載入失敗，請重試");
        setLoading(false);
      });
    return () => controller.abort();
  }, [activeStatus, activeCategory, debouncedQuery]);

  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-[var(--accent)]">碑帖管理</h1>
            <p className="text-sm text-[var(--muted)] mt-1">NPM 故宮數位典藏 · 標注工作台</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/export")}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              匯出 →
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              ← 返回首頁
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋名稱、編號、書法家..."
          className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
        />

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {(["all", "法書", "法帖", "拓片"] as const).map((cat) => {
            const count = cat === "all" ? totalAll : (categoryCounts[cat] || 0);
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  activeCategory === cat
                    ? "bg-[var(--accent)] text-[var(--background)]"
                    : "bg-[var(--card-bg)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {cat === "all" ? "全部類別" : cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveStatus("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              activeStatus === "all"
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "bg-[var(--card-bg)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            全部狀態 ({totalAll})
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                activeStatus === s
                  ? "bg-[var(--accent)] text-[var(--background)]"
                  : "bg-[var(--card-bg)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {STATUS_LABELS[s]} ({statusCounts[s] || 0})
            </button>
          ))}
        </div>

        {/* Work list */}
        {error ? (
          <div role="alert" className="flex items-center justify-center h-48 text-red-400 text-sm">
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48 text-[var(--muted)]">載入中...</div>
        ) : works.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--muted)] space-y-2">
            <p>尚無作品</p>
            <p className="text-xs">Run: <code className="bg-[var(--card-bg)] px-1 rounded">python pipeline/ingest.py --bulk</code></p>
          </div>
        ) : (
          <div className="space-y-2">
            {works.map((w) => (
              <div
                key={w.identifier}
                className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4 hover:border-[var(--accent-dim)] transition-colors cursor-pointer"
                onClick={() => router.push(`/admin/annotate?id=${encodeURIComponent(w.identifier)}`)}
              >
                {/* Status badge */}
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[w.status]}`}>
                  {STATUS_LABELS[w.status]}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base truncate">{w.displayName || w.name}</p>
                  {w.displayName && (
                    <p className="text-xs text-[var(--muted)] truncate">{w.name}</p>
                  )}
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {w.identifier}
                    {w.calligrapher && <span className="ml-2">· {w.calligrapher}</span>}
                    {w.era && <span className="ml-2">· {w.era}</span>}
                    {w.category && <span className="ml-2">· {w.category}</span>}
                  </p>
                </div>

                {/* Indicators */}
                <div className="shrink-0 flex items-center gap-3 text-xs text-[var(--muted)]">
                  {w.shiwen ? (
                    <span className="text-green-400">釋文 ✓</span>
                  ) : (
                    <span className="text-[var(--muted)]">釋文 ✗</span>
                  )}
                  <span>→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
