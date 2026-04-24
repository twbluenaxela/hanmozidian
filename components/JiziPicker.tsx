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
    // Only fetch if open and text exists. 
    // If text is empty, clear the coverage so we don't show stale authors.
    if (!open || !text.trim()) {
      setCoverage(null);
      return;
    }

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
    if (!coverage?.calligraphers) return [];
    return coverage.calligraphers.filter((c) => c.nameZh.includes(search));
  }, [coverage, search]);

  const filteredWorks = useMemo(() => {
    if (!coverage?.works) return [];
    return coverage.works.filter((w) => w.nameZh.includes(search));
  }, [coverage, search]);

  if (!open) return null;

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Search Input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
           <button onClick={onReset} className="text-[10px] text-[var(--accent)] uppercase font-bold hover:underline">Clear All</button>
        </div>
        <input
          type="text"
          placeholder={`搜索${tab === "author" ? "名家" : "碑帖"}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] mb-4">
        <button onClick={() => setTab("author")} className={`flex-1 pb-2 text-xs font-bold transition-all ${tab === "author" ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'text-[var(--muted)]'}`}>作者</button>
        <button onClick={() => setTab("work")} className={`flex-1 pb-2 text-xs font-bold transition-all ${tab === "work" ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'text-[var(--muted)]'}`}>作品</button>
      </div>

      {/* Bubbles */}
      <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="w-full text-center py-4 text-xs text-[var(--muted)] animate-pulse">載入中...</div>
        ) : !text.trim() ? (
          <div className="w-full text-center py-4 text-[10px] text-[var(--muted-dim)]">請先輸入漢字</div>
        ) : (tab === "author" ? filteredAuthors : filteredWorks).length === 0 ? (
          <div className="w-full text-center py-4 text-[10px] text-[var(--muted-dim)]">無匹配項</div>
        ) : (
          (tab === "author" ? filteredAuthors : filteredWorks).map((item) => {
            const isSelected = tab === "author" 
              ? selectedCalligraphers.includes(item.id)
              : selectedWorks.includes(item.id);
            const isEmpty = item.imageCount === 0;
            return (
              <button
                key={item.id}
                disabled={isEmpty}
                onClick={() => tab === "author" ? onToggleCalligrapher(item.id) : onToggleWork(item.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-2 ${
                  isEmpty 
                    ? "opacity-10 border-transparent cursor-not-allowed grayscale" 
                    : isSelected
                    ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--background)] shadow-lg scale-105"
                    : "bg-[var(--card-bg)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--card-hover)]"
                }`}
              >
                {item.nameZh}
                {!isEmpty && (
                  <span className={`text-[10px] font-bold ${isSelected ? 'text-[var(--background)] opacity-60' : 'text-[var(--accent)]'}`}>
                    {item.imageCount >= 50 ? "50+" : item.imageCount}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}