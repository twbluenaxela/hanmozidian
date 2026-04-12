"use client";

import { useState, useRef, useCallback } from "react";

interface ImageData {
  id: number;
  imagePath: string;
  imageUrl: string;
  calligrapherName: string | null;
  workName: string | null;
  calligrapherId: number | null;
  workId: number | null;
  styleName: string;
  styleSlug: string;
}

interface CharacterResult {
  character: string;
  found: boolean;
  images: ImageData[];
}

const STYLES = [
  { slug: "zhuan", nameZh: "篆書" },
  { slug: "li", nameZh: "隸書" },
  { slug: "kai", nameZh: "楷書" },
  { slug: "xing", nameZh: "行書" },
  { slug: "cao", nameZh: "草書" },
];

export default function JiziPage() {
  const [text, setText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("kai");
  const [results, setResults] = useState<CharacterResult[]>([]);
  const [loading, setLoading] = useState(false);
  // Track which image index is shown for each character position
  const [selections, setSelections] = useState<Record<number, number>>({});
  const isComposing = useRef(false);

  const handleCompose = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setSelections({});

    const params = new URLSearchParams({ text: text.trim(), style: selectedStyle });
    const res = await fetch(`/api/jizi?${params}`);
    const data = await res.json();
    setResults(data.characters || []);
    setLoading(false);
  }, [text, selectedStyle]);

  const cycleCharacter = (position: number, direction: 1 | -1) => {
    setSelections((prev) => {
      const current = prev[position] || 0;
      const total = results[position]?.images.length || 1;
      const next = (current + direction + total) % total;
      return { ...prev, [position]: next };
    });
  };

  return (
    <div className="min-h-full px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 text-[var(--foreground)]">集字</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        輸入詞句,選擇書法風格,組成作品參考
      </p>

      {/* Text input */}
      <div className="mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onCompositionEnd={(e) => {
            isComposing.current = false;
            setText(e.currentTarget.value);
          }}
          placeholder="輸入詞句,例如:天下為公"
          rows={2}
          className="w-full px-3 py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] text-lg resize-none"
        />
      </div>

      {/* Style selection */}
      <div className="mb-4">
        <p className="text-sm text-[var(--muted)] mb-2">選擇風格</p>
        <div className="flex gap-2 flex-wrap">
          {STYLES.map((style) => (
            <button
              key={style.slug}
              onClick={() => setSelectedStyle(style.slug)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                selectedStyle === style.slug
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "bg-[var(--card-bg)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card-hover)]"
              }`}
            >
              {style.nameZh}
            </button>
          ))}
        </div>
      </div>

      {/* Compose button */}
      <button
        onClick={handleCompose}
        disabled={!text.trim() || loading}
        className="w-full py-2.5 bg-[var(--foreground)] text-[var(--background)] rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        {loading ? "載入中..." : "集字"}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-8">
          <p className="text-sm text-[var(--muted)] mb-3">
            點擊字格左右箭頭切換不同書寫版本
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {results.map((result, idx) => {
              const selectedIdx = selections[idx] || 0;
              const currentImg = result.images[selectedIdx];

              return (
                <div
                  key={idx}
                  className="flex flex-col items-center"
                >
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 bg-[var(--card-bg)] rounded-lg overflow-hidden flex items-center justify-center border border-[var(--border)]">
                    {result.found && currentImg ? (
                      <>
                        <img
                          src={currentImg.imageUrl}
                          alt={result.character}
                          className="w-full h-full object-contain p-1"
                        />
                        {result.images.length > 1 && (
                          <>
                            <button
                              onClick={() => cycleCharacter(idx, -1)}
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-8 flex items-center justify-center bg-black/50 text-white text-xs hover:bg-black/70"
                            >
                              ‹
                            </button>
                            <button
                              onClick={() => cycleCharacter(idx, 1)}
                              className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-8 flex items-center justify-center bg-black/50 text-white text-xs hover:bg-black/70"
                            >
                              ›
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <span
                        className="text-4xl text-[var(--muted)]"
                        style={{ fontFamily: "serif" }}
                      >
                        {result.character}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--muted)] mt-1">
                    {result.found
                      ? currentImg?.calligrapherName || "-"
                      : "暫無"}
                  </span>
                  {result.found && result.images.length > 1 && (
                    <span className="text-[10px] text-[var(--muted)]">
                      {selectedIdx + 1}/{result.images.length}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
