"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import JiziPicker from "@/components/JiziPicker";
import CalligraphyCharacter from "@/components/CalligraphyCharacter";

export default function JiziPage() {
  const [text, setText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("kai");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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

    const params = new URLSearchParams({ text: text.trim(), style: selectedStyle });
    if (selectedCalligraphers.length > 0) params.set("calligrapher", selectedCalligraphers.join(","));
    if (selectedWorks.length > 0) params.set("work", selectedWorks.join(","));

    try {
      const res = await fetch(`/api/jizi?${params}`);
      const data = await res.json();
      setResults(data.characters || []);
      if (data.characters?.length > 0 && activeIndex === null) setActiveIndex(0);
    } finally {
      setLoading(false);
    }
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks, activeIndex]);

  useEffect(() => {
    if (text.trim() && !isComposing.current) handleCompose();
  }, [selectedCalligraphers, selectedWorks, selectedStyle, handleCompose]);

  const updateCharSetting = (idx: number, key: string, val: any) => {
    setComposition(prev => ({
      ...prev,
      [idx]: { ...(prev[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false }), [key]: val }
    }));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)]">
      <main className="flex-1 overflow-y-auto custom-scrollbar transition-all duration-300">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <h1 className="font-display text-4xl mb-6">集字工坊</h1>

          <div className="space-y-6">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="輸入詞句..."
              className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 text-2xl font-display focus:outline-none focus:border-[var(--accent)] resize-none"
              rows={1}
            />

            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {["金文", "小篆", "隸", "楷", "行", "草"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedStyle(s)}
                    className={`px-4 py-1.5 rounded-full text-sm font-display border transition-all ${
                      selectedStyle === s ? "bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPickerOpen(!pickerOpen)}
                className={`px-6 py-2 rounded-full text-sm font-display transition-all ${
                  pickerOpen ? "bg-[var(--foreground)] text-[var(--background)]" : "border border-[var(--border)] text-[var(--foreground)]"
                }`}
              >
                {pickerOpen ? "收起工具" : "展開工具"}
              </button>
            </div>

            {/* THE CANVAS */}
            <div className="flex flex-wrap gap-6 justify-center p-12 bg-[var(--card-bg)] rounded-xl min-h-[400px] border border-[var(--border)]">
              {results.map((res, idx) => {
                const settings = composition[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false };
                const currentImg = res.images[settings.imgIdx];
                return (
                  <div 
                    key={idx} 
                    onClick={() => setActiveIndex(idx)}
                    className={`relative cursor-pointer transition-all rounded-xl ${activeIndex === idx ? 'ring-2 ring-[var(--accent)] ring-offset-4 ring-offset-[var(--background)]' : ''}`}
                  >
                    {res.found && currentImg ? (
                      <CalligraphyCharacter 
                        imageUrl={currentImg.imageUrl} 
                        char={res.character}
                        grid={settings.grid}
                        invert={settings.invert}
                        wireframe={settings.wireframe}
                        size={140}
                      />
                    ) : (
                      <div className="w-[140px] h-[140px] border border-dashed border-[var(--border)] flex items-center justify-center text-[var(--muted)] text-4xl font-display">
                        {res.character}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* SIDEBAR WORKBENCH */}
      <aside className={`transition-all duration-300 ease-in-out border-l border-[var(--border)] flex-shrink-0 flex flex-col ${pickerOpen ? "w-96" : "w-0 opacity-0 overflow-hidden"}`}>
        {activeIndex !== null && results[activeIndex] ? (
          <div className="flex flex-col h-full bg-[var(--background)]">
            <div className="p-6 border-b border-[var(--border)]">
              <h2 className="text-xl font-display text-[var(--foreground)]">編輯: {results[activeIndex].character}</h2>
              
              {/* Image Manipulation Tools */}
              <div className="mt-4 space-y-4">
                <div className="flex gap-2">
                  {['none', 'mi', 'jiu'].map(g => (
                    <button 
                      key={g} 
                      onClick={() => updateCharSetting(activeIndex, 'grid', g)}
                      className={`flex-1 py-1 text-xs rounded border border-[var(--border)] ${composition[activeIndex]?.grid === g ? 'bg-[var(--accent)] text-[var(--background)]' : 'text-[var(--muted)]'}`}
                    >
                      {g === 'none' ? '無格' : g === 'mi' ? '米字' : '九宮'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-4 text-sm text-[var(--muted)]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={composition[activeIndex]?.invert || false} onChange={e => updateCharSetting(activeIndex, 'invert', e.target.checked)} />
                    反色
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={composition[activeIndex]?.wireframe || false} onChange={e => updateCharSetting(activeIndex, 'wireframe', e.target.checked)} />
                    骨架
                  </label>
                </div>
              </div>
            </div>

            {/* Version Selection inside Sidebar */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 custom-scrollbar">
              {results[activeIndex].images.map((img: any, i: number) => (
                <button 
                  key={i}
                  onClick={() => updateCharSetting(activeIndex, 'imgIdx', i)}
                  className={`p-2 rounded-lg border transition-all ${composition[activeIndex]?.imgIdx === i ? 'border-[var(--accent)] bg-[var(--card-hover)]' : 'border-[var(--border)]'}`}
                >
                  <img src={img.imageUrl} className="w-full h-auto aspect-square object-contain" />
                  <span className="block text-[10px] text-[var(--muted)] mt-1 truncate">{img.calligrapherName}</span>
                </button>
              ))}
            </div>

            {/* Global Filters (Authors/Works) */}
            <div className="h-1/2 border-t border-[var(--border)]">
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
        ) : (
          <div className="p-12 text-center text-[var(--muted)]">點擊左側字稿開始編輯</div>
        )}
      </aside>
    </div>
  );
}