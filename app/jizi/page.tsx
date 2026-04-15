"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import JiziPicker from "@/components/JiziPicker";
import CalligraphyCharacter from "@/components/CalligraphyCharacter";

const STYLES = [
  { slug: "jinwen", nameZh: "金文" },
  { slug: "zhuan", nameZh: "小篆" },
  { slug: "li", nameZh: "隸書" },
  { slug: "kai", nameZh: "楷書" },
  { slug: "xing", nameZh: "行書" },
  { slug: "cao", nameZh: "草書" },
];

export default function JiziPage() {
  const [text, setText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("kai");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(true);

  // Multi-select state
  const [activeIndices, setActiveIndices] = useState<number[]>([]);
  const lastClickedIndex = useRef<number | null>(null);

  const [selectedCalligraphers, setSelectedCalligraphers] = useState<number[]>([]);
  const [selectedWorks, setSelectedWorks] = useState<number[]>([]);

  const [composition, setComposition] = useState<Record<number, {
    imgIdx: number;
    grid: "none" | "jiu" | "mi";
    invert: boolean;
    wireframe: boolean;
    removeBg: boolean;
  }>>({});

  const isComposing = useRef(false);

  // Multi-select click logic (Shift/Ctrl/Cmd)
  const handleCharClick = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (e.shiftKey && lastClickedIndex.current !== null) {
      const start = Math.min(lastClickedIndex.current, idx);
      const end = Math.max(lastClickedIndex.current, idx);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setActiveIndices(prev => Array.from(new Set([...prev, ...range])));
    } else if (e.ctrlKey || e.metaKey) {
      setActiveIndices(prev =>
        prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      );
    } else {
      setActiveIndices([idx]);
    }
    lastClickedIndex.current = idx;
  };

  const handleSelectAll = () => {
    if (activeIndices.length === results.length) {
      setActiveIndices([]);
    } else {
      setActiveIndices(results.map((_, i) => i));
    }
  };

  const handleCompose = useCallback(async () => {
    if (!text.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);

    const params = new URLSearchParams({ text: text.trim(), style: selectedStyle });
    if (selectedCalligraphers.length > 0) params.set("calligrapher", selectedCalligraphers.join(","));
    if (selectedWorks.length > 0) params.set("work", selectedWorks.join(","));

    try {
      const res = await fetch(`/api/jizi?${params}`);
      const data = await res.json();
      const newResults = data.characters || [];
      
      setResults(newResults);

      // Reset image indices if they are out of bounds after filtering
      setComposition(prev => {
        const next = { ...prev };
        newResults.forEach((charData: any, idx: number) => {
          if (next[idx] && next[idx].imgIdx >= (charData.images?.length || 0)) {
            next[idx] = { ...next[idx], imgIdx: 0 };
          }
        });
        return next;
      });

      // Default selection for first-time results
      if (newResults.length > 0 && activeIndices.length === 0) {
        setActiveIndices([0]);
        lastClickedIndex.current = 0;
      }
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.trim() && !isComposing.current) {
        handleCompose();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks, handleCompose]);

  const updateActiveCharsSetting = (key: string, val: any) => {
    setComposition(prev => {
      const next = { ...prev };
      activeIndices.forEach(idx => {
        next[idx] = {
          ...(next[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false, removeBg: false }),
          [key]: val
        };
      });
      return next;
    });
  };

  const getSetting = (key: "grid" | "invert" | "wireframe" | "removeBg" | "imgIdx") => {
    if (activeIndices.length === 0) return false;
    return composition[activeIndices[0]]?.[key];
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="font-display text-3xl mb-2 text-[var(--foreground)]">集字工坊</h1>
              <p className="text-[var(--muted)] text-sm">輸入內容，點擊字格進行細部調整 (支援 Shift / Cmd 批量多選)</p>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onCompositionStart={() => (isComposing.current = true)}
              onCompositionEnd={() => {
                isComposing.current = false;
                handleCompose();
              }}
              placeholder="請在此輸入漢字..."
              className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 text-3xl font-display focus:outline-none focus:border-[var(--accent)] shadow-xl transition-all resize-none"
              rows={1}
            />

            {results.length > 0 && (
              <div className="flex justify-between items-center px-2">
                <p className="text-sm font-bold text-[var(--muted)]">
                  已選取 <span className="text-[var(--accent)]">{activeIndices.length}</span> / {results.length} 字
                  {loading && <span className="ml-3 animate-pulse text-[var(--accent)]">更新中...</span>}
                </p>
                <button
                  onClick={handleSelectAll}
                  className="text-xs font-bold px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all shadow-sm"
                >
                  {activeIndices.length === results.length ? "取消全選" : "全選 (Select All)"}
                </button>
              </div>
            )}

            <div className={`bg-[var(--card-bg)] rounded-3xl min-h-[400px] border border-[var(--border)] shadow-inner flex flex-wrap gap-6 justify-center items-center p-12 transition-all duration-500 relative ${loading ? 'opacity-70' : ''}`}>
              {results.length === 0 && !loading ? (
                <div className="text-[var(--muted-dim)] font-display text-xl text-center px-10">
                  暫無內容，請在上方輸入框輸入詞句
                </div>
              ) : (
                results.map((res, idx) => {
                  const s = composition[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false, removeBg: false };
                  const currentImg = res.images && res.images.length > 0 ? (res.images[s.imgIdx] || res.images[0]) : null;
                  const isSelected = activeIndices.includes(idx);

                  return (
                    <div
                      key={idx}
                      onClick={(e) => handleCharClick(idx, e)}
                      className={`relative cursor-pointer transition-all duration-300 rounded-xl group ${
                        isSelected
                          ? 'scale-110 z-10 ring-2 ring-[var(--accent)] ring-offset-8 ring-offset-[var(--card-bg)] shadow-2xl'
                          : 'opacity-80 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      {res.found && currentImg ? (
                        <CalligraphyCharacter
                          imageUrl={currentImg.imageUrl}
                          char={res.character}
                          grid={s.grid}
                          invert={s.invert}
                          wireframe={s.wireframe}
                          removeBg={s.removeBg}
                          size={160}
                        />
                      ) : (
                        <div className="w-[160px] h-[160px] border-2 border-dashed border-[var(--border)] rounded-xl flex flex-col items-center justify-center bg-[var(--background)]">
                          <span className="text-5xl font-display text-[var(--muted-dim)] opacity-40">{res.character}</span>
                          <span className="text-[10px] mt-2 text-red-500/50 font-bold uppercase">無匹配數據</span>
                        </div>
                      )}

                      <div className="absolute -bottom-6 left-0 right-0 text-center text-[10px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity truncate">
                        {res.found && currentImg ? (currentImg.calligrapherName || "未知作者") : "篩選條件無結果"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {!pickerOpen && (
          <button
            onClick={() => setPickerOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-24 bg-[var(--accent)] text-[var(--background)] rounded-l-xl flex flex-col items-center justify-center font-bold shadow-lg"
          >
            展開
          </button>
        )}
      </main>

      <aside className={`h-full border-l border-[var(--border)] bg-[var(--background)] flex flex-col shadow-2xl transition-all duration-500 ease-in-out ${pickerOpen ? "w-[420px]" : "w-0 overflow-hidden"}`}>
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--card-bg)]">
          <h2 className="text-xl font-display font-bold">集字控制台</h2>
          <button onClick={() => setPickerOpen(false)} className="text-2xl hover:text-[var(--accent)] p-2">»</button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {/* Section A: Global Style */}
          <div className="p-6 border-b border-[var(--border)]">
            <p className="text-[10px] uppercase tracking-tighter text-[var(--muted)] mb-3 font-bold">1. 全局字體風格</p>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map(s => (
                <button
                  key={s.slug}
                  onClick={() => setSelectedStyle(s.slug)}
                  className={`py-2 rounded-lg text-sm border transition-all ${selectedStyle === s.slug ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)] shadow-lg' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'}`}
                >
                  {s.nameZh}
                </button>
              ))}
            </div>
          </div>

          {/* Section B: Single/Multi Editor */}
          {activeIndices.length > 0 ? (
            <div className="p-6 border-b border-[var(--border)] bg-[var(--card-bg)]/20 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-[10px] uppercase text-[var(--accent)] font-bold">
                  2. {activeIndices.length === 1 ? `單字編輯: ${results[activeIndices[0]]?.character}` : `批量編輯 (${activeIndices.length} 字)`}
                </p>
                {activeIndices.length === 1 && (
                  <span className="text-[10px] text-[var(--muted)]">{results[activeIndices[0]]?.images?.length || 0} 個候選</span>
                )}
              </div>

              {/* VARIANT PICKER THUMBNAILS (1 selected) */}
              {activeIndices.length === 1 && results[activeIndices[0]]?.images?.length > 0 && (
                <div className="mb-6">
                  <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar snap-x">
                    {results[activeIndices[0]].images.map((img: any, imgIdx: number) => {
                      const isSelected = getSetting('imgIdx') === imgIdx;
                      return (
                        <button
                          key={imgIdx}
                          onClick={() => updateActiveCharsSetting('imgIdx', imgIdx)}
                          className={`snap-start flex-shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden bg-white transition-all ${
                            isSelected ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--background)]' : 'border-[var(--border)] opacity-60 hover:opacity-100 hover:border-gray-400'
                          }`}
                        >
                          <img src={img.imageUrl} alt="variant" className="w-full h-full object-contain filter grayscale contrast-200" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => updateActiveCharsSetting('grid', getSetting('grid') === 'mi' ? 'none' : 'mi')}
                    className={`flex-1 py-3 rounded-xl border transition-all font-bold text-xs ${getSetting('grid') === 'mi' ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)] bg-[var(--card-bg)]'}`}
                  >
                    米字格
                  </button>
                  <button
                    onClick={() => updateActiveCharsSetting('grid', getSetting('grid') === 'jiu' ? 'none' : 'jiu')}
                    className={`flex-1 py-3 rounded-xl border transition-all font-bold text-xs ${getSetting('grid') === 'jiu' ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)] bg-[var(--card-bg)]'}`}
                  >
                    九宮格
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateActiveCharsSetting('invert', !getSetting('invert'))}
                    className={`py-2.5 rounded-xl border text-[10px] font-bold transition-all ${getSetting('invert') ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'}`}
                  >
                    反色 (拓片)
                  </button>
                  <button
                    onClick={() => updateActiveCharsSetting('wireframe', !getSetting('wireframe'))}
                    className={`py-2.5 rounded-xl border text-[10px] font-bold transition-all ${getSetting('wireframe') ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'}`}
                  >
                    骨架 (線稿)
                  </button>
                </div>

                <button
                  onClick={() => updateActiveCharsSetting('removeBg', !getSetting('removeBg'))}
                  className={`w-full py-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${getSetting('removeBg') ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)] shadow-lg' : 'border-[var(--border)] text-[var(--muted)] bg-[var(--card-bg)]'}`}
                >
                  {getSetting('removeBg') ? '✓ 已開啟去底模式' : '一鍵去底 (顯示透視網格)'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-[var(--muted-dim)] border-b border-[var(--border)] italic text-sm">
              請在左側點擊字格開始細部調整
            </div>
          )}

          {/* Section C: Filters */}
          <div className="p-6">
            <p className="text-[10px] uppercase tracking-tighter text-[var(--muted)] mb-3 font-bold">3. 名家篩選</p>
            <JiziPicker
              text={text}
              style={selectedStyle}
              open={pickerOpen}
              selectedCalligraphers={selectedCalligraphers}
              selectedWorks={selectedWorks}
              onToggleCalligrapher={(id) => setSelectedCalligraphers(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              onToggleWork={(id) => setSelectedWorks(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              onReset={() => { setSelectedCalligraphers([]); setSelectedWorks([]); }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}