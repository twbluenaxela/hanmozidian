"use client";

import { useState } from "react";

interface Calligrapher {
  id: number;
  nameZh: string;
  dynasty: string | null;
}

interface SubFilterProps {
  filterMode: "author" | "work";
  onFilterModeChange: (mode: "author" | "work") => void;
  calligraphers: Calligrapher[];
  selectedCalligrapher: number | null;
  onCalligrapherChange: (id: number | null) => void;
}

export default function SubFilter({
  filterMode,
  onFilterModeChange,
  calligraphers,
  selectedCalligrapher,
  onCalligrapherChange,
}: SubFilterProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex gap-1">
        <button
          onClick={() => onFilterModeChange("author")}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            filterMode === "author"
              ? "bg-[var(--accent)] text-[var(--background)]"
              : "text-[var(--muted)] hover:text-[var(--accent-bright)]"
          }`}
        >
          作者
        </button>
        <button
          onClick={() => onFilterModeChange("work")}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            filterMode === "work"
              ? "bg-[var(--accent)] text-[var(--background)]"
              : "text-[var(--muted)] hover:text-[var(--accent-bright)]"
          }`}
        >
          作品
        </button>
      </div>

      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--accent-bright)]"
        >
          篩選
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            <button
              onClick={() => {
                onCalligrapherChange(null);
                setShowDropdown(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--card-hover)] ${
                !selectedCalligrapher ? "text-[var(--accent)]" : "text-[var(--foreground)]"
              }`}
            >
              全部
            </button>
            {calligraphers.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onCalligrapherChange(c.id);
                  setShowDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--card-hover)] ${
                  selectedCalligrapher === c.id
                    ? "text-[var(--accent)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                {c.nameZh}
                {c.dynasty && (
                  <span className="ml-1 text-[var(--muted)]">({c.dynasty})</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
