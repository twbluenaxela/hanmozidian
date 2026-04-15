"use client";

import { useEffect, useState } from "react";

interface CoverageCalligrapher {
  id: number;
  nameZh: string;
  dynasty: string | null;
  imageCount: number;
}

interface CoverageWork {
  id: number;
  nameZh: string;
  calligrapherName: string | null;
  imageCount: number;
}

interface CoverageResponse {
  characters: Array<{ char: string; id: number | null; found: boolean }>;
  calligraphers: CoverageCalligrapher[];
  works: CoverageWork[];
}

export interface JiziPickerSelection {
  calligraphers: number[];
  works: number[];
}

interface JiziPickerProps {
  text: string;
  style: string;
  open: boolean;
  selectedCalligraphers: number[];
  selectedWorks: number[];
  onApply: (next: JiziPickerSelection) => void;
  onClose: () => void;
}

export default function JiziPicker({
  text,
  style,
  open,
  selectedCalligraphers,
  selectedWorks,
  onApply,
  onClose,
}: JiziPickerProps) {
  const [tab, setTab] = useState<"author" | "work">("author");
  const [localCalligraphers, setLocalCalligraphers] = useState<number[]>([]);
  const [localWorks, setLocalWorks] = useState<number[]>([]);
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset local state whenever the modal opens so it mirrors the parent's
  // committed selection at the moment of opening.
  useEffect(() => {
    if (open) {
      setLocalCalligraphers(selectedCalligraphers);
      setLocalWorks(selectedWorks);
    }
  }, [open, selectedCalligraphers, selectedWorks]);

  // Fetch facets when the modal opens or when text/style changes. The
  // guard on `open` avoids fetching for an invisible modal.
  useEffect(() => {
    if (!open || !text.trim()) return;

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ text: text.trim(), style });
    fetch(`/api/jizi/coverage?${params.toString()}`)
      .then((res) => res.json())
      .then((data: CoverageResponse) => {
        if (!cancelled) {
          setCoverage(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCoverage(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, text, style]);

  if (!open) return null;

  const toggleCalligrapher = (id: number) => {
    setLocalCalligraphers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleWork = (id: number) => {
    setLocalWorks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleReset = () => {
    setLocalCalligraphers([]);
    setLocalWorks([]);
  };

  const handleApply = () => {
    onApply({ calligraphers: localCalligraphers, works: localWorks });
    onClose();
  };

  const formatCount = (n: number) => (n >= 50 ? "50+" : String(n));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background)] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-[var(--border)] flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-baseline justify-between border-b border-[var(--border)]">
          <h2 className="font-display text-[var(--foreground)] text-xl">
            篩選條件
          </h2>
          <span className="text-xs text-[var(--muted)]">
            (可選，不選表示全部)
          </span>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <button
            onClick={() => setTab("author")}
            className={`font-display px-4 py-1 rounded-full text-sm transition-colors ${
              tab === "author"
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "text-[var(--muted)] hover:text-[var(--accent-bright)]"
            }`}
          >
            作者
          </button>
          <button
            onClick={() => setTab("work")}
            className={`font-display px-4 py-1 rounded-full text-sm transition-colors ${
              tab === "work"
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "text-[var(--muted)] hover:text-[var(--accent-bright)]"
            }`}
          >
            作品
          </button>
          <span className="ml-auto text-xs text-[var(--muted)]">(可多選)</span>
        </div>

        {/* Chip grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && (
            <div className="text-center text-sm text-[var(--muted)] py-8">
              載入中...
            </div>
          )}

          {!loading && coverage && tab === "author" && (
            <div className="grid grid-cols-3 gap-2">
              {coverage.calligraphers.map((c) => {
                const isSelected = localCalligraphers.includes(c.id);
                const isEmpty = c.imageCount === 0;
                return (
                  <button
                    key={c.id}
                    disabled={isEmpty}
                    onClick={() => toggleCalligrapher(c.id)}
                    className={`font-display text-sm px-2 py-2 rounded-full border transition-colors flex items-baseline justify-center gap-1 ${
                      isEmpty
                        ? "border-[var(--border)] text-[var(--muted-dim)] cursor-not-allowed opacity-50"
                        : isSelected
                        ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--card-hover)]"
                        : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--muted-dim)] hover:bg-[var(--card-hover)]"
                    }`}
                  >
                    <span className="truncate">{c.nameZh}</span>
                    {!isEmpty && (
                      <sub className="text-[10px] text-[var(--muted)] align-baseline">
                        {formatCount(c.imageCount)}
                      </sub>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!loading && coverage && tab === "work" && (
            <div className="grid grid-cols-3 gap-2">
              {coverage.works.length === 0 && (
                <div className="col-span-3 text-center text-sm text-[var(--muted)] py-8">
                  暫無作品資料
                </div>
              )}
              {coverage.works.map((w) => {
                const isSelected = localWorks.includes(w.id);
                const isEmpty = w.imageCount === 0;
                return (
                  <button
                    key={w.id}
                    disabled={isEmpty}
                    onClick={() => toggleWork(w.id)}
                    className={`font-display text-sm px-2 py-2 rounded-full border transition-colors flex items-baseline justify-center gap-1 ${
                      isEmpty
                        ? "border-[var(--border)] text-[var(--muted-dim)] cursor-not-allowed opacity-50"
                        : isSelected
                        ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--card-hover)]"
                        : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--muted-dim)] hover:bg-[var(--card-hover)]"
                    }`}
                  >
                    <span className="truncate">{w.nameZh}</span>
                    {!isEmpty && (
                      <sub className="text-[10px] text-[var(--muted)] align-baseline">
                        {formatCount(w.imageCount)}
                      </sub>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !coverage && (
            <div className="text-center text-sm text-[var(--muted)] py-8">
              載入失敗
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border)] flex gap-3">
          <button
            onClick={handleReset}
            className="font-display flex-1 py-2 rounded-full border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--muted-dim)] hover:bg-[var(--card-hover)] transition-colors text-sm"
          >
            重置
          </button>
          <button
            onClick={handleApply}
            className="font-display flex-1 py-2 rounded-full bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent-bright)] transition-colors text-sm font-bold"
          >
            確認
          </button>
        </div>
      </div>
    </div>
  );
}