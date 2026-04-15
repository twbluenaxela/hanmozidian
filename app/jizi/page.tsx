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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
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

  const toggleGrid = (idx: number, type: "mi" | "jiu") => {
  const currentGrid = composition[idx]?.grid || "none";
  updateCharSetting(idx, "grid", currentGrid === type ? "none" : type);
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
      setResults(data.characters || []);
      // If we just loaded new results and nothing is selected, select the first one
      if (data.characters?.length > 0 && activeIndex === null) {
        setActiveIndex(0);
      }
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks]);

  // Trigger search when global filters or text changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.trim() && !isComposing.current) {
        handleCompose();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks, handleCompose]);

  const updateCharSetting = (idx: number, key: string, val: any) => {
    setComposition(prev => ({
      ...prev,
      [idx]: { 
        ...(prev[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false, removeBg: false }), 
        [key]: val 
      }
    }));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* 1. LEFT SIDE: THE CANVAS */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">
          <div className="max-w-4xl mx-auto space-y-8">
            <div>
              <h1 className="font-display text-3xl mb-2">集字工坊</h1>
              <p className="text-[var(--muted)] text-sm">輸入內容，點擊字格進行細部調整</p>
            </div>

            {/* Input Area */}
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

{/* The Paper/Canvas */}
            <div className="bg-[var(--card-bg)] rounded-3xl min-h-[400px] border border-[var(--border)] shadow-inner flex flex-wrap gap-6 justify-center items-center p-12 transition-all duration-500">
              {results.length === 0 ? (
                <div className="text-[var(--muted-dim)] font-display text-xl text-center px-10">
                  {loading ? "正在搜集字跡..." : "暫無內容，請在上方輸入框輸入詞句"}
                </div>
              ) : (
                results.map((res, idx) => {
                  const s = composition[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false, removeBg: false };
                  
                  // Safely find the image, falling back to the first one if the index is missing
                  const currentImg = res.images?.[s.imgIdx] || res.images?.[0];
                  
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setActiveIndex(idx)}
                      className={`relative cursor-pointer transition-all duration-300 rounded-xl group ${
                        activeIndex === idx 
                          ? 'scale-110 z-10 ring-2 ring-[var(--accent)] ring-offset-8 ring-offset-[var(--card-bg)]' 
                          : 'opacity-80 hover:opacity-100'
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
                        <div className="w-[160px] h-[160px] border-2 border-dashed border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--muted-dim)] text-5xl font-display">
                          {res.character}
                        </div>
                      )}
                      
                      {/* Fixed: Use optional chaining and check currentImg existence */}
                      <div className="absolute -bottom-6 left-0 right-0 text-center text-[10px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity truncate">
                        {res.found && currentImg ? (currentImg.calligrapherName || "未知作者") : "無數據"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Small Toggle to re-open sidebar if closed */}
        {!pickerOpen && (
          <button 
            onClick={() => setPickerOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-24 bg-[var(--accent)] text-[var(--background)] rounded-l-xl flex flex-col items-center justify-center font-bold shadow-lg"
          >
            展開
          </button>
        )}
      </main>

      {/* 2. RIGHT SIDE: THE CONTROL PANEL */}
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

           {/* Section B: Single Character Editor (Contextual) */}
           {activeIndex !== null && results[activeIndex] ? (
             <div className="p-6 border-b border-[var(--border)] bg-[var(--card-bg)]/20 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-baseline justify-between mb-4">
                  <p className="text-[10px] uppercase text-[var(--accent)] font-bold">2. 單字編輯: {results[activeIndex].character}</p>
                  <span className="text-[10px] text-[var(--muted)]">{results[activeIndex].images.length} 個候選</span>
                </div>
                
            <div className="space-y-3">
              {/* Row 1: Grid Toggles */}
              <div className="flex gap-2">
                <button 
                  onClick={() => toggleGrid(activeIndex!, 'mi')}
                  className={`flex-1 py-3 rounded-xl border transition-all font-bold text-xs ${
                    composition[activeIndex!]?.grid === 'mi' 
                      ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]' 
                      : 'border-[var(--border)] text-[var(--muted)] bg-[var(--card-bg)]'
                  }`}
                >
                  米字格
                </button>
                <button 
                  onClick={() => toggleGrid(activeIndex!, 'jiu')}
                  className={`flex-1 py-3 rounded-xl border transition-all font-bold text-xs ${
                    composition[activeIndex!]?.grid === 'jiu' 
                      ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]' 
                      : 'border-[var(--border)] text-[var(--muted)] bg-[var(--card-bg)]'
                  }`}
                >
                  九宮格
                </button>
              </div>

              {/* Row 2: Character Manipulators */}
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => updateCharSetting(activeIndex!, 'invert', !composition[activeIndex!]?.invert)}
                  className={`py-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                    composition[activeIndex!]?.invert 
                      ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' 
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'
                  }`}
                >
                  反色 (拓片)
                </button>

                <button 
                  onClick={() => updateCharSetting(activeIndex!, 'wireframe', !composition[activeIndex!]?.wireframe)}
                  className={`py-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                    composition[activeIndex!]?.wireframe 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg' 
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'
                  }`}
                >
                  骨架 (線稿)
                </button>
              </div>

              {/* Row 3: The Big Background Eraser */}
              <button 
                onClick={() => updateCharSetting(activeIndex!, 'removeBg', !composition[activeIndex!]?.removeBg)}
                className={`w-full py-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  composition[activeIndex!]?.removeBg 
                    ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)] shadow-lg' 
                    : 'border-[var(--border)] text-[var(--muted)] bg-[var(--card-bg)]'
                }`}
              >
                {composition[activeIndex!]?.removeBg ? '✓ 已開啟去底模式' : '一鍵去底 (顯示透視網格)'}
              </button>
            </div>
             </div>
           ) : (
             <div className="p-10 text-center text-[var(--muted-dim)] border-b border-[var(--border)] italic text-sm">
                請在左側點擊字格開始細部調整
             </div>
           )}

           {/* Section C: Global Search Filters */}
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