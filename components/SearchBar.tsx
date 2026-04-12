"use client";

import { useState, useRef, useCallback } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = "輸入漢字...",
  initialValue = "",
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const isComposing = useRef(false);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) {
      onSearch(trimmed);
    }
  }, [value, onSearch]);

  return (
    <div className="flex items-center gap-2 w-full max-w-lg mx-auto">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onCompositionEnd={(e) => {
            isComposing.current = false;
            setValue(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isComposing.current) {
              handleSubmit();
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] text-lg"
        />
      </div>
      <button
        onClick={handleSubmit}
        className="px-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-colors"
      >
        搜索
      </button>
    </div>
  );
}
