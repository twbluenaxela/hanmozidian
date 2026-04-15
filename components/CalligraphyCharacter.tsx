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
  const [pickerOpen, setPickerOpen] = useState(true); // Open by default for workbench feel
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  const [selectedCalligraphers, setSelectedCalligraphers] = useState<number[]>([]);
  const [selectedWorks, setSelectedWorks] = useState<number[]>([]);
  const [composition, setComposition] = useState<Record<number, {
    imgIdx: number;
    grid: "none" | "jiu" | "mi";
    invert: boolean;
    wireframe: boolean;
  }>>({});

  const isComposing = useRef(false);

  const handleCompose = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);

    const params = new URLSearchParams({ 
      text: text.trim(), 
      style: selectedStyle 
    });
    
    if (selectedCalligraphers.length > 0) params.set("calligrapher", selectedCalligraphers.join(","));
    if (selectedWorks.length > 0) params.set("work", selectedWorks.join(","));

    try {
      const res = await fetch(`/api/jizi?${params}`);
      const data = await res.json();
      setResults(data.characters || []);
      // Auto-select first char if none selected
      if (data.characters?.length > 0 && activeIndex === null) setActiveIndex(0);
    } finally {
      setLoading(false);
    }
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks, activeIndex]);

  // Unified trigger for any change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.trim() && !isComposing.current) handleCompose();
    }, 300); // Debounce to prevent API spamming
    return () => clearTimeout(timer);
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks, handleCompose]);

  const updateCharSetting = (idx: number, key: string, val: any) => {
    setComposition(prev => ({
      ...prev,
      [idx]: { ...(prev[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false }), [key]: val }
    }));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)]">
      {/* MAIN CANVAS */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="font-display text-4xl mb-8 opacity-80">集字工坊</h1>

          <div className="space-y-10">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="輸入詞句 (如: 你好)"
              className="w-full bg-transparent border-b-2 border-[var(--border)] p-2 text-4xl font-display focus:outline-none focus:border-[var(--accent)] transition-all"
              rows={1}
            />

            <div className="flex flex-wrap gap-8 justify-center p-16 bg-[var(--card-bg)] rounded-3xl min-h-[500px] border border-[var(--border)] shadow-2xl relative">
              {results.map((res, idx) => {
                const settings = composition[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false };
                const currentImg = res.images[settings.imgIdx];
                return (
                  <div 
                    key={idx} 
                    onClick={() => setActiveIndex(idx)}
                    className={`relative cursor-pointer transition-all duration-300 rounded-xl ${activeIndex === idx ? 'scale-110 z-10 ring-4 ring-[var(--accent)] ring-offset-8 ring-offset-[var(--card-bg)] shadow-2xl' : 'opacity-80 hover:opacity-100'}`}
                  >
                    {res.found && currentImg ? (
                      <CalligraphyCharacter 
                        imageUrl={currentImg.imageUrl} 
                        char={res.character}
                        grid={settings.grid}
                        invert={settings.invert}
                        wireframe={settings.wireframe}
                        size={160}
                      />
                    ) : (
                      <div className="w-[160px] h-[160px] border-2 border-dashed border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--muted)] text-5xl font-display">
                        {res.character}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* LARGE TOGGLE BUTTON */}
        {!pickerOpen && (
          <button 
            onClick={() => setPickerOpen(true)}
            className="fixed right-6 top-1/2 -translate-y-1/2 w-12 h-24 bg-[var(--accent)] text-[var(--background)] rounded-l-2xl flex flex-col items-center justify-center gap-2 font-bold shadow-xl hover:w-14 transition-all"
          >
            <span>展開</span>
            <span className="text-lg">‹</span>
          </button>
        )}
      </main>

      {/* UNIFIED WORKBENCH SIDEBAR */}
      <aside className={`transition-all duration-500 ease-in-out border-l border-[var(--border)] flex-shrink-0 flex flex-col shadow-2xl bg-[var(--background)] z-50 ${pickerOpen ? "w-[400px]" : "w-0 opacity-0 overflow-hidden"}`}>
        <div className="flex flex-col h-full">
          {/* Header & Close */}
          <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--card-bg)]">
            <h2 className="text-xl font-display font-bold">控制台</h2>
            <button 
              onClick={() => setPickerOpen(false)}
              className="w-10 h-10 rounded-full hover:bg-[var(--background)] flex items-center justify-center transition-colors text-xl"
            >
              ›
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* 1. Global Style Selector */}
            <div className="p-6 border-b border-[var(--border)]">
              <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest mb-4">全局書體</p>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.slug}
                    onClick={() => setSelectedStyle(s.slug)}
                    className={`py-2 rounded-lg text-sm font-display border transition-all ${
                      selectedStyle === s.slug ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--background)] shadow-lg shadow-[var(--accent)]/20" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]"
                    }`}
                  >
                    {s.nameZh}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Character Specific Tools */}
            {activeIndex !== null && results[activeIndex] && (
              <div className="p-6 border-b border-[var(--border)] bg-[var(--card-bg)]/30">
                <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest mb-4">單字編輯: {results[activeIndex].character}</p>
                
                <div className="space-y-6">
                  {/* Grids */}
                  <div className="flex gap-2">
                    {['none', 'mi', 'jiu'].map(g => (
                      <button 
                        key={g} 
                        onClick={() => updateCharSetting(activeIndex, 'grid', g)}
                        className={`flex-1 py-2 text-xs rounded-xl border border-[var(--border)] font-bold ${composition[activeIndex]?.grid === g ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]' : 'text-[var(--muted)] bg-[var(--background)]'}`}
                      >
                        {g === 'none' ? '無格' : g === 'mi' ? '米字' : '九宮'}
                      </button>
                    ))}
                  </div>

                  {/* Toggles */}
                  <div className="flex gap-6 p-4 bg-[var(--background)] rounded-2xl border border-[var(--border)]">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input type="checkbox" className="w-5 h-5 accent-[var(--accent)]" checked={composition[activeIndex]?.invert || false} onChange={e => updateCharSetting(activeIndex, 'invert', e.target.checked)} />
                      <span className="text-sm font-bold">反色</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input type="checkbox" className="w-5 h-5 accent-[var(--accent)]" checked={composition[activeIndex]?.wireframe || false} onChange={e => updateCharSetting(activeIndex, 'wireframe', e.target.checked)} />
                      <span className="text-sm font-bold">骨架</span>
                    </label>
                  </div>

                  {/* Versions */}
                  <div>
                    <p className="text-[10px] text-[var(--muted)] mb-3">其他版本 ({results[activeIndex].images.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {results[activeIndex].images.map((img: any, i: number) => (
                        <button 
                          key={i}
                          onClick={() => updateCharSetting(activeIndex, 'imgIdx', i)}
                          className={`aspect-square p-1 rounded-lg border-2 transition-all overflow-hidden bg-white ${composition[activeIndex]?.imgIdx === i ? 'border-[var(--accent)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        >
                          <img src={img.imageUrl} className="w-full h-full object-contain" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Author/Work Search (JiziPicker) */}
            <div className="p-6">
               <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest mb-4">篩選工具</p>
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
        </div>
      </aside>
    </div>
  );
}