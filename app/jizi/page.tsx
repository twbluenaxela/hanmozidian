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
  selectedImageId?: number;
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
  const [pickerOpen, setPickerOpen] = useState(false); // Default closed on mobile
  const [paper, setPaper] = useState(PAPERS[0]);
  const [isExporting, setIsExporting] = useState(false);
  
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [gridSize, setGridSize] = useState(120); // Default smaller for mobile
  const [gap, setGap] = useState(16);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [activeIndices, setActiveIndices] = useState<number[]>([]);
  const lastClickedIndex = useRef<number | null>(null);

  const [selectedCalligraphers, setSelectedCalligraphers] = useState<number[]>([]);
  const [selectedWorks, setSelectedWorks] = useState<number[]>([]);
  const [composition, setComposition] = useState<Record<number, CompositionItem>>({});

  const DEFAULT_SETTINGS: CompositionItem = {
    selectedImageId: undefined,
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

  // SANITIZATION
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const rawValue = e.target.value;
    const sanitized = rawValue.replace(/[\u200B-\u200D\uFEFF]/g, "");
    setText(sanitized);
  };

  // EXPORT ENGINE (Issue 4 Fix: Captures full scrollable area)
  const handleExport = async () => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    const prevSelection = [...activeIndices];
    setActiveIndices([]); // Hide selection glows
    setPickerOpen(false); // Close sidebar so it doesn't overlap

    try {
      await new Promise(r => setTimeout(r, 300)); // Let UI settle
      const dataUrl = await toPng(canvasRef.current, {
        pixelRatio: 3,
        backgroundColor: paper.color === 'transparent' ? undefined : paper.color,
        // Ensure no cutoff
        width: canvasRef.current.scrollWidth,
        height: canvasRef.current.scrollHeight,
        style: { transform: 'none' }
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
      setPickerOpen(true); // Auto-open sidebar when selecting a char
    }
    lastClickedIndex.current = idx;
  };

  const updateActiveCharsSetting = (key: keyof CompositionItem, val: any) => {
    setComposition(prev => {
      const next = { ...prev };
      activeIndices.forEach(idx => {
        const current = next[idx] || { ...DEFAULT_SETTINGS };
        next[idx] = { ...current, [key]: val };
      });
      return next;
    });
  };

  const getSetting = <K extends keyof CompositionItem>(key: K): CompositionItem[K] => {
    if (activeIndices.length === 0) return DEFAULT_SETTINGS[key];
    const item = composition[activeIndices[0]];
    return item ? item[key] : DEFAULT_SETTINGS[key];
  };

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
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)] relative">
      {/* MAIN CANVAS AREA */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-none p-4 md:p-8 space-y-4 z-10 bg-[var(--background)]/80 backdrop-blur-md">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="font-display text-2xl md:text-4xl text-[var(--accent)]">集字工坊</h1>
            </div>
            <button onClick={handleExport} disabled={isExporting} className="bg-[var(--accent)] text-[var(--background)] px-4 md:px-8 py-2 md:py-3 rounded-xl font-bold shadow-md hover:scale-105 transition-all text-sm md:text-base">
              {isExporting ? "匯出中..." : "匯出作品"}
            </button>
          </div>

          <textarea
            value={text}
            onChange={handleTextChange}
            className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 text-2xl md:text-4xl font-display focus:border-[var(--accent)] transition-all resize-none h-24"
            placeholder="輸入漢字..."
          />

          <div className="flex justify-between items-center px-1">
            <div className="flex gap-4 items-center">
               <div className="flex gap-2">
                  {PAPERS.map(p => (
                    <button key={p.id} onClick={() => setPaper(p)} className={`w-6 h-6 rounded-full border-2 ${paper.id === p.id ? 'border-[var(--accent)] scale-110' : 'border-transparent'}`} style={{ backgroundColor: p.color === 'transparent' ? '#333' : p.color }} />
                  ))}
               </div>
            </div>
            <button onClick={() => setActiveIndices(activeIndices.length === results.length ? [] : results.map((_,i)=>i))} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
               {activeIndices.length === results.length ? "取消全選" : "全選"}
            </button>
          </div>
        </div>

        {/* EXPORT WRAPPER (Issues 2, 3, 4 Fix) */}
        <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-12 relative flex justify-center">
          <div 
            ref={canvasRef}
            style={{ 
              backgroundColor: paper.color,
              display: 'flex',
              flexWrap: 'wrap',
              flexDirection: orientation === 'vertical' ? 'column' : 'row',
              writingMode: orientation === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
              alignContent: orientation === 'vertical' ? 'flex-start' : 'center',
              justifyContent: 'center',
              gap: `${gap}px`,
              // Issue 3: Constrain vertical height so it wraps right-to-left
              maxHeight: orientation === 'vertical' ? '65vh' : 'none',
              padding: '32px',
              // Issue 4: Ensure it grows to fit all content for exporting
              width: 'max-content',
              minWidth: '100%',
            }}
            className={`rounded-2xl transition-opacity duration-500 ${loading ? 'opacity-50' : 'opacity-100'}`}
          >
            {results.map((res, idx) => {
              const s = composition[idx] || DEFAULT_SETTINGS;
              
              // Issue 5: Strict String Coercion to prevent ID mismatch
              let currentImg = null;
              if (res.images && res.images.length > 0) {
                if (s.selectedImageId) {
                  currentImg = res.images.find((i: any) => String(i.id) === String(s.selectedImageId));
                }
                if (!currentImg) currentImg = res.images[0];
              }

              const isSelected = activeIndices.includes(idx);
              
              return (
                <div 
                  key={`${idx}-${currentImg?.id || 'empty'}`} 
                  onClick={(e) => handleCharClick(idx, e)} 
                  style={{ writingMode: 'horizontal-tb', width: gridSize, height: gridSize }}
                  className={`relative cursor-pointer transition-all duration-200 flex items-center justify-center shrink-0 ${isSelected ? 'z-10' : 'opacity-95'}`}
                >
                  {isSelected && (
                    <div className="absolute inset-[-4px] border-2 border-[var(--accent)] rounded-xl animate-pulse pointer-events-none" />
                  )}

                  {res.found && currentImg?.imageUrl ? (
                    <CalligraphyCharacter imageUrl={currentImg.imageUrl} char={res.character} {...s} size={gridSize} />
                  ) : (
                    <div style={{ width: gridSize, height: gridSize }} className="border-2 border-dashed border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--muted-dim)] text-4xl font-display">
                      {res.character}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* MOBILE OVERLAY HANDLE */}
      {!pickerOpen && (
        <button 
          onClick={() => setPickerOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-[var(--card-bg)] border border-[var(--border)] border-r-0 p-2 pl-3 rounded-l-xl z-40 hover:bg-[var(--accent)] transition-all"
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl">«</span>
            <span className="text-[10px] [writing-mode:vertical-lr] font-bold">控制台</span>
          </div>
        </button>
      )}

      {/* SIDEBAR (Issue 1 & 6 Fix: Fixed overlay on mobile, relative on desktop, no shadow) */}
      <aside className={`
        fixed md:relative right-0 inset-y-0 z-50 bg-[var(--background)] border-l border-[var(--border)]
        flex flex-col transition-transform duration-300 ease-in-out
        ${pickerOpen ? "translate-x-0 w-[85vw] md:w-[380px]" : "translate-x-full md:w-0 overflow-hidden"}
      `}>
        <div className="p-4 md:p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--card-bg)] shrink-0">
           <h2 className="text-lg md:text-xl font-bold">集字控制台</h2>
           <button onClick={() => setPickerOpen(false)} className="w-8 h-8 rounded-full bg-[var(--background)] border flex items-center justify-center text-lg">»</button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 p-4 md:p-6">
           <div className="p-4 bg-[var(--card-bg)] rounded-xl space-y-4">
              <p className="text-[10px] uppercase font-bold text-[var(--accent)]">版面與網格</p>
              <div className="flex gap-2">
                <button onClick={() => setOrientation('horizontal')} className={`flex-1 py-2 rounded-lg border text-xs ${orientation === 'horizontal' ? 'bg-[var(--accent)] text-[var(--background)]' : 'border-[var(--border)]'}`}>橫排 (LTR)</button>
                <button onClick={() => setOrientation('vertical')} className={`flex-1 py-2 rounded-lg border text-xs ${orientation === 'vertical' ? 'bg-[var(--accent)] text-[var(--background)]' : 'border-[var(--border)]'}`}>直排 (RTL)</button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--muted)] w-16">格子: {gridSize}</span>
                  <input type="range" min="60" max="240" value={gridSize} onChange={(e) => setGridSize(parseInt(e.target.value))} className="flex-1 accent-[var(--accent)]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--muted)] w-16">間距: {gap}</span>
                  <input type="range" min="0" max="60" value={gap} onChange={(e) => setGap(parseInt(e.target.value))} className="flex-1 accent-[var(--accent)]" />
                </div>
              </div>
           </div>

           {/* ALTERNATIVES GALLERY (Issue 5 Fix: String coercion on click) */}
           {activeIndices.length === 1 && results[activeIndices[0]]?.images?.length > 1 && (
             <div className="p-4 bg-[var(--card-bg)] rounded-xl border border-[var(--border)]">
               <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-3">替換版本</p>
               <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                 {results[activeIndices[0]].images.map((img: any) => (
                   <button
                     key={img.id}
                     onClick={() => updateActiveCharsSetting('selectedImageId', img.id)}
                     className={`aspect-square bg-white rounded-lg border-2 overflow-hidden ${
                       String(composition[activeIndices[0]]?.selectedImageId) === String(img.id) 
                         ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30' 
                         : 'border-transparent'
                     }`}
                   >
                     <img src={`${img.imageUrl}?thumb=1`} className="w-full h-full object-contain grayscale" />
                   </button>
                 ))}
               </div>
             </div>
           )}

           <div className="grid grid-cols-3 gap-2">
             {STYLES.map(s => (
               <button key={s.slug} onClick={() => setSelectedStyle(s.slug)} className={`py-2 rounded-lg text-xs border ${selectedStyle === s.slug ? 'bg-[var(--accent)] text-[var(--background)]' : 'border-[var(--border)]'}`}>{s.nameZh}</button>
             ))}
           </div>

           {activeIndices.length > 0 && (
             <div className="space-y-4">
                <div className="p-4 bg-[var(--card-bg)] rounded-xl space-y-4">
                  <p className="text-[10px] uppercase font-bold text-[var(--accent)]">造型設定</p>
                  <div className="flex gap-2">
                    <button onClick={() => updateActiveCharsSetting('showBorder', !getSetting('showBorder'))} className={`flex-1 py-2 rounded-lg border text-xs ${getSetting('showBorder') ? 'bg-[var(--accent)] text-[var(--background)]' : ''}`}>
                      {getSetting('showBorder') ? "隱藏邊框" : "顯示邊框"}
                    </button>
                    <button onClick={() => updateActiveCharsSetting('borderShape', getSetting('borderShape') === 'circle' ? 'square' : 'circle')} className="flex-1 py-2 rounded-lg border text-xs">
                      {getSetting('borderShape') === 'circle' ? "切換方形" : "切換圓形"}
                    </button>
                  </div>
                  {getSetting('showBorder') && (
                    <div className="flex justify-between pt-2">
                      {BORDER_COLORS.map(c => (
                        <button key={c} onClick={() => updateActiveCharsSetting('borderColor', c)} className={`w-6 h-6 rounded-full border-2 ${getSetting('borderColor') === c ? 'border-[var(--accent)]' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => updateActiveCharsSetting('grid', getSetting('grid') === 'mi' ? 'none' : 'mi')} className={`py-2 rounded-xl border text-xs ${getSetting('grid') === 'mi' ? 'bg-[var(--accent)] text-[var(--background)]' : 'bg-[var(--card-bg)]'}`}>米字格</button>
                   <button onClick={() => updateActiveCharsSetting('grid', getSetting('grid') === 'jiu' ? 'none' : 'jiu')} className={`py-2 rounded-xl border text-xs ${getSetting('grid') === 'jiu' ? 'bg-[var(--accent)] text-[var(--background)]' : 'bg-[var(--card-bg)]'}`}>九宮格</button>
                   <button onClick={() => updateActiveCharsSetting('invert', !getSetting('invert'))} className={`py-2 rounded-xl border text-xs ${getSetting('invert') ? 'bg-white text-black' : 'bg-[var(--card-bg)]'}`}>反色 (拓片)</button>
                   <button onClick={() => updateActiveCharsSetting('wireframe', !getSetting('wireframe'))} className={`py-2 rounded-xl border text-xs ${getSetting('wireframe') ? 'bg-blue-600 text-white' : 'bg-[var(--card-bg)]'}`}>骨架 (線稿)</button>
                </div>
                <button onClick={() => updateActiveCharsSetting('removeBg', !getSetting('removeBg'))} className={`w-full py-3 rounded-xl border text-xs font-bold ${getSetting('removeBg') ? 'bg-[var(--accent)] text-[var(--background)]' : 'bg-[var(--card-bg)]'}`}>一鍵去底</button>
             </div>
           )}

           <JiziPicker
             text={text} style={selectedStyle} open={true} // Inside sidebar, always render picker logic
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