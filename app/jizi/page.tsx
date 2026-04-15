"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import JiziPicker, { type JiziPickerSelection } from "@/components/JiziPicker";

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

// Light-weight mirror of CoverageResponse — we only need names for the
// applied-selection chip strip below the input. Avoids a second fetch.
interface FacetMeta {
  calligraphers: Record<number, string>;
  works: Record<number, string>;
}

const STYLES = [
  { slug: "jinwen", nameZh: "金文" },
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

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCalligraphers, setSelectedCalligraphers] = useState<number[]>([]);
  const [selectedWorks, setSelectedWorks] = useState<number[]>([]);
  const [facetMeta, setFacetMeta] = useState<FacetMeta>({
    calligraphers: {},
    works: {},
  });

  // Clear picker filters whenever the input or style changes — stale
  // filters don't make sense against a different phrase.
  useEffect(() => {
    setSelectedCalligraphers([]);
    setSelectedWorks([]);
  }, [text, selectedStyle]);

  const handleCompose = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setSelections({});

    const params = new URLSearchParams({ 
      text: text.trim(), 
      style: selectedStyle 
    });

    if (selectedCalligraphers.length > 0) {
      params.set("calligrapher", selectedCalligraphers.join(","));
    }
    if (selectedWorks.length > 0) {
      params.set("work", selectedWorks.join(","));
    }

    const res = await fetch(`/api/jizi?${params}`);
    const data = await res.json();
    setResults(data.characters || []);
    setLoading(false);
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks]);

  const handlePickerApply = useCallback(
    async (next: JiziPickerSelection) => {
      setSelectedCalligraphers(next.calligraphers);
      setSelectedWorks(next.works);

      // Refresh name lookup so the chip strip below the input can show
      // something meaningful. Reuse the coverage endpoint — it returns
      // every calligrapher + work for the current phrase.
      if (text.trim()) {
        const params = new URLSearchParams({
          text: text.trim(),
          style: selectedStyle,
        });
        try {
          const res = await fetch(`/api/jizi/coverage?${params.toString()}`);
          const data = await res.json();
          const cMap: Record<number, string> = {};
          const wMap: Record<number, string> = {};
          for (const c of data.calligraphers || []) cMap[c.id] = c.nameZh;
          for (const w of data.works || []) wMap[w.id] = w.nameZh;
          setFacetMeta({ calligraphers: cMap, works: wMap });
        } catch {
          // Non-fatal: chips fall back to "#id" rendering.
        }
      }
    },
    [text, selectedStyle]
  );

  const removeCalligrapher = (id: number) => {
    setSelectedCalligraphers((prev) => prev.filter((x) => x !== id));
  };

  const removeWork = (id: number) => {
    setSelectedWorks((prev) => prev.filter((x) => x !== id));
  };

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
      <h1 className="font-display text-[var(--foreground)] text-4xl mb-1">
        集字
      </h1>
      <p className="text-sm text-[var(--muted)] mb-6 tracking-wide">
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
          className="font-display w-full px-3 py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] text-lg resize-none transition-colors"
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
              className={`font-display px-4 py-1.5 rounded-full text-sm transition-colors ${
                selectedStyle === style.slug
                  ? "bg-[var(--card-hover)] border border-[var(--accent)] text-[var(--accent)]"
                  : "bg-[var(--card-bg)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card-hover)] hover:border-[var(--muted-dim)]"
              }`}
            >
              {style.nameZh}
            </button>
          ))}
        </div>
      </div>

      {/* Compose + filter buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCompose}
          disabled={!text.trim() || loading}
          className="font-display tracking-widest flex-1 py-3 bg-transparent text-[var(--accent)] border border-[var(--accent)] rounded-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--accent)] hover:text-[var(--background)] transition-colors"
        >
          {loading ? "載入中..." : "集 字"}
        </button>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={!text.trim()}
          className="font-display px-5 py-3 bg-transparent text-[var(--muted)] border border-[var(--border)] rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:text-[var(--accent)] hover:border-[var(--muted-dim)] transition-colors"
        >
          篩選
          {(selectedCalligraphers.length + selectedWorks.length) > 0 && (
            <span className="ml-1 text-[var(--accent)]">
              ({selectedCalligraphers.length + selectedWorks.length})
            </span>
          )}
        </button>
      </div>

      {/* Active selection chip strip */}
      {(selectedCalligraphers.length > 0 || selectedWorks.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedCalligraphers.map((id) => (
            <button
              key={`c-${id}`}
              onClick={() => removeCalligrapher(id)}
              className="font-display text-xs px-3 py-1 rounded-full border border-[var(--accent)] text-[var(--accent)] bg-[var(--card-hover)] hover:bg-[var(--card-bg)] transition-colors flex items-center gap-1"
            >
              {facetMeta.calligraphers[id] ?? `#${id}`}
              <span className="text-[var(--muted)]">×</span>
            </button>
          ))}
          {selectedWorks.map((id) => (
            <button
              key={`w-${id}`}
              onClick={() => removeWork(id)}
              className="font-display text-xs px-3 py-1 rounded-full border border-[var(--accent)] text-[var(--accent)] bg-[var(--card-hover)] hover:bg-[var(--card-bg)] transition-colors flex items-center gap-1"
            >
              {facetMeta.works[id] ?? `#${id}`}
              <span className="text-[var(--muted)]">×</span>
            </button>
          ))}
        </div>
      )}

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
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-8 flex items-center justify-center bg-black/60 text-[var(--foreground)] text-xs hover:bg-black/80 hover:text-[var(--accent)]"
                            >
                              ‹
                            </button>
                            <button
                              onClick={() => cycleCharacter(idx, 1)}
                              className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-8 flex items-center justify-center bg-black/60 text-[var(--foreground)] text-xs hover:bg-black/80 hover:text-[var(--accent)]"
                            >
                              ›
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="font-display text-4xl text-[var(--muted-dim)]">
                        {result.character}
                      </span>
                    )}
                  </div>
                  <span className="font-display text-xs text-[var(--muted)] mt-1">
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

      <JiziPicker
        text={text}
        style={selectedStyle}
        open={pickerOpen}
        selectedCalligraphers={selectedCalligraphers}
        selectedWorks={selectedWorks}
        onApply={handlePickerApply}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}