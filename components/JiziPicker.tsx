"use client";

import { useEffect, useState, useMemo } from "react";

interface CoverageCalligrapher {
  id: number;
  nameZh: string;
  imageCount: number;
}

interface CoverageWork {
  id: number;
  nameZh: string;
  imageCount: number;
}

interface CoverageResponse {
  calligraphers: CoverageCalligrapher[];
  works: CoverageWork[];
}

interface JiziPickerProps {
  text: string;
  style: string;
  open: boolean;
  selectedCalligraphers: number[];
  selectedWorks: number[];
  onToggleCalligrapher: (id: number) => void;
  onToggleWork: (id: number) => void;
  onReset: () => void;
}

export default function JiziPicker({
  text,
  style,
  open,
  selectedCalligraphers,
  selectedWorks,
  onToggleCalligrapher,
  onToggleWork,
  onReset,
}: JiziPickerProps) {
  const [tab, setTab] = useState<"author" | "work">("author");
  const [search, setSearch] = useState("");
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !text.trim()) return;
    setLoading(true);
    const params = new URLSearchParams({ text: text.trim(), style });
    fetch(`/api/jizi/coverage?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setCoverage(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, text, style]);

  const filteredAuthors = useMemo(() => {
    if (!coverage) return [];
    return coverage.calligraphers.filter((c) => c.nameZh.includes(search));
  }, [coverage, search]);

  const filteredWorks = useMemo(() => {
    if (!coverage) return [];
    return coverage.works.filter((w) => w.nameZh.includes(search));
  }, [coverage, search]);

  if (!open) return null;

  return (
    <div className="h-full flex flex-col bg-[var(--background)] border-l border-[var(--border)] w-80 md:w-96 shadow-xl">
      <div className="p-4 border-b border-[var(--border)] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">篩選工具</h2>
          <button onClick={onReset} className="text-xs text-[var(--accent)] hover:underline">
            清除全部
          </button>
        </div>
        <input
          type="text"
          placeholder={`搜索${tab === "author" ? "作者" : "作品"}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      <div className="flex border-b border-[var(--border)]">
        {["author", "work"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`flex-1 py-3 text-sm font-display border-b-2 transition-colors ${
              tab === t ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)]"
            }`}
          >
            {t === "author" ? "作者" : "作品"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <div className="text-center text-[var(--muted)] py-10 animate-pulse">載入中...</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(tab === "author" ? filteredAuthors : filteredWorks).map((item) => {
              const isSelected = tab === "author" 
                ? selectedCalligraphers.includes(item.id)
                : selectedWorks.includes(item.id);
              const isEmpty = item.imageCount === 0;

              return (
                <button
                  key={item.id}
                  disabled={isEmpty}
                  onClick={() => tab === "author" ? onToggleCalligrapher(item.id) : onToggleWork(item.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-display border transition-all flex items-center gap-1.5 ${
                    isEmpty 
                      ? "opacity-20 border-transparent cursor-not-allowed" 
                      : isSelected
                      ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--background)]"
                      : "bg-[var(--card-bg)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--muted)]"
                  }`}
                >
                  {item.nameZh}
                  {!isEmpty && (
                    <span className={`text-[9px] opacity-60`}>
                      {item.imageCount >= 50 ? "50+" : item.imageCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}