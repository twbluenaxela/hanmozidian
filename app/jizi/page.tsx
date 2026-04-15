"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import JiziPicker from "@/components/JiziPicker";
import CalligraphyCharacter from "@/components/CalligraphyCharacter";
import { toPng } from 'html-to-image';

const STYLES = [
  { slug: "jinwen", nameZh: "金文" },
  { slug: "zhuan", nameZh: "小篆" },
  { slug: "li", nameZh: "隸書" },
  { slug: "kai", nameZh: "楷書" },
  { slug: "xing", nameZh: "行書" },
  { slug: "cao", nameZh: "草書" },
];

const PAPERS = [
  { id: 'transparent', name: '透明', color: 'transparent' },
  { id: 'white', name: '純白', color: '#ffffff' },
  { id: 'xuan', name: '生宣', color: '#fcfaf2' },
  { id: 'gold', name: '金箋', color: '#e6d5a7' },
];

const BORDER_COLORS = ["#d4af37", "#8b0000", "#000000", "#333333", "#e5e7eb"];

type CompositionItem = {
  imgIdx: number;
  grid: "none" | "jiu" | "mi";
  invert: boolean;
  wireframe: boolean;
  removeBg: boolean;
  showBorder: boolean;
  borderShape: "square" | "circle";
  borderWidth: number;
  borderColor: string;
};

export default function JiziPage() {
  const [text, setText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("kai");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [paper, setPaper] = useState(PAPERS[0]);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [activeIndices, setActiveIndices] = useState<number[]>([]);
  const lastClickedIndex = useRef<number | null>(null);

  const [selectedCalligraphers, setSelectedCalligraphers] = useState<number[]>([]);
  const [selectedWorks, setSelectedWorks] = useState<number[]>([]);
  
 // Updated state with the new type
  const [composition, setComposition] = useState<Record<number, CompositionItem>>({});

  // Define the DEFAULT object to reuse and avoid "undefined" errors
  const DEFAULT_SETTINGS: CompositionItem = {
    imgIdx: 0,
    grid: 'none',
    invert: false,
    wireframe: false,
    removeBg: false,
    showBorder: true,
    borderShape: 'square',
    borderWidth: 2,
    borderColor: '#d4af37'
  };

  const isComposing = useRef(false);

  // EXPORT ENGINE
  const handleExport = async () => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    const prevSelection = [...activeIndices];
    setActiveIndices([]); // Clear selection glow for export

    try {
      await new Promise(r => setTimeout(r, 200)); // Let UI settle
      const dataUrl = await toPng(canvasRef.current, {
        pixelRatio: 3,
        backgroundColor: paper.color === 'transparent' ? undefined : paper.color,
      });
      const link = document.createElement('a');
      link.download = `shufa-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      alert("匯出失敗，請確保圖片伺服器允許跨域訪問。");
      console.error(err);
    } finally {
      setActiveIndices(prevSelection);
      setIsExporting(false);
    }
  };

  const handleCharClick = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (e.shiftKey && lastClickedIndex.current !== null) {
      const start = Math.min(lastClickedIndex.current, idx);
      const end = Math.max(lastClickedIndex.current, idx);
      setActiveIndices(Array.from({ length: end - start + 1 }, (_, i) => start + i));
    } else if (e.ctrlKey || e.metaKey) {
      setActiveIndices(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx]);
    } else {
      setActiveIndices([idx]);
    }
    lastClickedIndex.current = idx;
  };

 // FIX: Explicitly type the 'key' as keyof CompositionItem
  const updateActiveCharsSetting = (key: keyof CompositionItem, val: any) => {
    setComposition(prev => {
      const next = { ...prev };
      activeIndices.forEach(idx => {
        const current = next[idx] || { ...DEFAULT_SETTINGS };
        next[idx] = { 
          ...current, 
          [key]: val 
        };
      });
      return next;
    });
  };

  // This syntax tells TS to look at the specific key provided and return that specific type
  const getSetting = <K extends keyof CompositionItem>(key: K): CompositionItem[K] => {
    if (activeIndices.length === 0) return DEFAULT_SETTINGS[key];
    const item = composition[activeIndices[0]];
    
    // If the item exists, return its value; otherwise return the default
    return item ? item[key] : DEFAULT_SETTINGS[key];
  };


  // FETCH LOGIC
  const handleCompose = useCallback(async () => {
    if (!text.trim()) { setResults([]); return; }
    setLoading(true);
    const params = new URLSearchParams({ text: text.trim(), style: selectedStyle });
    if (selectedCalligraphers.length > 0) params.set("calligrapher", selectedCalligraphers.join(","));
    if (selectedWorks.length > 0) params.set("work", selectedWorks.join(","));
    try {
      const res = await fetch(`/api/jizi?${params}`);
      const data = await res.json();
      setResults(data.characters || []);
      if (data.characters?.length > 0 && activeIndices.length === 0) setActiveIndices([0]);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks]);

  useEffect(() => {
    const timer = setTimeout(() => { if (text.trim() && !isComposing.current) handleCompose(); }, 400);
    return () => clearTimeout(timer);
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks, handleCompose]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="font-display text-4xl mb-2">集字工坊</h1>
                <p className="text-[var(--muted)] text-sm">輸入內容，點擊字格進行細部調整</p>
              </div>
              <button 
                onClick={handleExport}
                disabled={isExporting}
                className="bg-[var(--accent)] text-[var(--background)] px-8 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-all"
              >
                {isExporting ? "匯出中..." : "匯出作品 (PNG)"}
              </button>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 text-4xl font-display focus:border-[var(--accent)] shadow-xl transition-all resize-none h-32"
              placeholder="輸入漢字..."
            />

            <div className="flex justify-between items-center px-2">
              <div className="flex gap-4 items-center">
                 <p className="text-sm font-bold text-[var(--muted)]">已選取 <span className="text-[var(--accent)]">{activeIndices.length}</span> / {results.length} 字</p>
                 <div className="flex gap-2">
                    {PAPERS.map(p => (
                      <button key={p.id} onClick={() => setPaper(p)} className={`w-6 h-6 rounded-full border-2 ${paper.id === p.id ? 'border-[var(--accent)] scale-110' : 'border-transparent'}`} style={{ backgroundColor: p.color === 'transparent' ? '#333' : p.color }} />
                    ))}
                 </div>
              </div>
              <button onClick={() => setActiveIndices(activeIndices.length === results.length ? [] : results.map((_,i)=>i))} className="text-xs font-bold px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
                 {activeIndices.length === results.length ? "取消全選" : "全選 (Select All)"}
              </button>
            </div>

            <div 
              ref={canvasRef}
              style={{ backgroundColor: paper.color }}
              className={`rounded-3xl min-h-[400px] flex flex-wrap gap-6 justify-center items-center p-12 transition-all duration-500 relative ${loading ? 'opacity-60' : ''}`}
            >
              {results.map((res, idx) => {
                const s = composition[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false, removeBg: false, showBorder: true, borderShape: 'square', borderWidth: 2, borderColor: '#d4af37' };
                const currentImg = res.images?.[s.imgIdx] || res.images?.[0];
                const isSelected = activeIndices.includes(idx);
                
                return (
                  <div key={idx} onClick={(e) => handleCharClick(idx, e)} className={`relative cursor-pointer transition-all duration-300 ${isSelected ? 'scale-110 z-10' : 'opacity-90'}`}>
                    {res.found && currentImg ? (
                      <CalligraphyCharacter imageUrl={currentImg.imageUrl} char={res.character} {...s} size={180} />
                    ) : (
                      <div className="w-[180px] h-[180px] border-2 border-dashed border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--muted-dim)] text-6xl font-display">{res.character}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <aside className={`h-full border-l border-[var(--border)] bg-[var(--background)] flex flex-col shadow-2xl transition-all ${pickerOpen ? "w-[420px]" : "w-0 overflow-hidden"}`}>
        <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--card-bg)]">
           <h2 className="text-xl font-bold">集字控制台</h2>
           <button onClick={() => setPickerOpen(false)} className="text-2xl">»</button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 p-6">
           <div className="grid grid-cols-3 gap-2">
             {STYLES.map(s => (
               <button key={s.slug} onClick={() => setSelectedStyle(s.slug)} className={`py-2 rounded-lg text-sm border transition-all ${selectedStyle === s.slug ? 'bg-[var(--accent)] text-[var(--background)]' : 'border-[var(--border)]'}`}>{s.nameZh}</button>
             ))}
           </div>

           {activeIndices.length > 0 && (
             <div className="space-y-6">
                <div className="p-4 bg-[var(--card-bg)] rounded-2xl space-y-4">
                  <p className="text-[10px] uppercase font-bold text-[var(--accent)]">邊框與造型設定</p>
                  
                  <div className="flex gap-2">
                    <button onClick={() => updateActiveCharsSetting('showBorder', !getSetting('showBorder'))} className={`flex-1 py-2 rounded-lg border text-xs ${getSetting('showBorder') ? 'bg-[var(--accent)] text-[var(--background)]' : 'bg-transparent'}`}>
                      {getSetting('showBorder') ? "隱藏邊框" : "顯示邊框"}
                    </button>
                    <button onClick={() => updateActiveCharsSetting('borderShape', getSetting('borderShape') === 'circle' ? 'square' : 'circle')} className="flex-1 py-2 rounded-lg border text-xs bg-transparent">
                      {getSetting('borderShape') === 'circle' ? "切換方形" : "切換圓形"}
                    </button>
                  </div>

                  {getSetting('showBorder') && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] text-[var(--muted)]">粗細: {getSetting('borderWidth')}px</span>
                         <input type="range" min="1" max="10" value={getSetting('borderWidth') || 1} onChange={(e) => updateActiveCharsSetting('borderWidth', parseInt(e.target.value))} className="w-2/3 accent-[var(--accent)]" />
                      </div>
                      <div className="flex justify-between">
                        {BORDER_COLORS.map(c => (
                          <button key={c} onClick={() => updateActiveCharsSetting('borderColor', c)} className={`w-8 h-8 rounded-full border-2 ${getSetting('borderColor') === c ? 'border-[var(--accent)] scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => updateActiveCharsSetting('grid', getSetting('grid') === 'mi' ? 'none' : 'mi')} className={`py-3 rounded-xl border text-xs font-bold ${getSetting('grid') === 'mi' ? 'bg-[var(--accent)] text-[var(--background)]' : 'bg-[var(--card-bg)]'}`}>米字格</button>
                   <button onClick={() => updateActiveCharsSetting('grid', getSetting('grid') === 'jiu' ? 'none' : 'jiu')} className={`py-3 rounded-xl border text-xs font-bold ${getSetting('grid') === 'jiu' ? 'bg-[var(--accent)] text-[var(--background)]' : 'bg-[var(--card-bg)]'}`}>九宮格</button>
                   <button onClick={() => updateActiveCharsSetting('invert', !getSetting('invert'))} className={`py-3 rounded-xl border text-xs font-bold ${getSetting('invert') ? 'bg-white text-black' : 'bg-[var(--card-bg)]'}`}>反色 (拓片)</button>
                   <button onClick={() => updateActiveCharsSetting('wireframe', !getSetting('wireframe'))} className={`py-3 rounded-xl border text-xs font-bold ${getSetting('wireframe') ? 'bg-blue-600 text-white' : 'bg-[var(--card-bg)]'}`}>骨架 (線稿)</button>
                </div>
                <button onClick={() => updateActiveCharsSetting('removeBg', !getSetting('removeBg'))} className={`w-full py-4 rounded-xl border font-bold text-sm ${getSetting('removeBg') ? 'bg-[var(--accent)] text-[var(--background)]' : 'bg-[var(--card-bg)]'}`}>一鍵去底 (顯示透視背景)</button>
             </div>
           )}

           <JiziPicker
             text={text} style={selectedStyle} open={pickerOpen}
             selectedCalligraphers={selectedCalligraphers} selectedWorks={selectedWorks}
             onToggleCalligrapher={(id) => setSelectedCalligraphers(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
             onToggleWork={(id) => setSelectedWorks(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
             onReset={() => { setSelectedCalligraphers([]); setSelectedWorks([]); }}
           />
        </div>
      </aside>
    </div>
  );
}