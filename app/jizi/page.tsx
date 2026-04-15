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

// Traditional Paper Textures/Colors
const PAPERS = [
  { id: 'transparent', name: '透明', color: 'transparent' },
  { id: 'white', name: '純白', color: '#ffffff' },
  { id: 'xuan', name: '生宣', color: '#fcfaf2' }, // Classic off-white paper
  { id: 'gold', name: '金箋', color: '#e6d5a7' }, // Aged gold/yellow paper
];

export default function JiziPage() {
  const [text, setText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("kai");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [paper, setPaper] = useState(PAPERS[0]);
  const [isExporting, setIsExporting] = useState(false);

  const [activeIndices, setActiveIndices] = useState<number[]>([]);
  const lastClickedIndex = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null); // For exporting

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

  // --- EXPORT LOGIC ---
  const handleExport = async () => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    
    // Deselect for a clean export
    const prevSelection = [...activeIndices];
    setActiveIndices([]);

    try {
      // Small delay to ensure UI updates
      await new Promise(r => setTimeout(r, 100));

      const dataUrl = await toPng(canvasRef.current, {
        pixelRatio: 3, // High-res export
        backgroundColor: paper.color === 'transparent' ? undefined : paper.color,
        style: {
          padding: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }
      });

      const link = document.createElement('a');
      link.download = `shufa-export-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
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

  const updateActiveCharsSetting = (key: string, val: any) => {
    setComposition(prev => {
      const next = { ...prev };
      activeIndices.forEach(idx => {
        next[idx] = { ...(next[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false, removeBg: false }), [key]: val };
      });
      return next;
    });
  };

  const getSetting = (key: any) => activeIndices.length > 0 ? composition[activeIndices[0]]?.[key] : null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="font-display text-4xl mb-2">集字工坊</h1>
                <p className="text-[var(--muted)] text-sm">輸入內容，支援多選與高解析度匯出</p>
              </div>
              
              {/* Export Button */}
              <button 
                onClick={handleExport}
                disabled={isExporting || results.length === 0}
                className="bg-[var(--accent)] text-[var(--background)] px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-all disabled:opacity-50"
              >
                {isExporting ? "正在匯出..." : "匯出作品 (PNG)"}
              </button>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onCompositionStart={() => (isComposing.current = true)}
              onCompositionEnd={() => { isComposing.current = false; handleCompose(); }}
              className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 text-4xl font-display focus:border-[var(--accent)] shadow-xl transition-all resize-none h-32"
              placeholder="輸入漢字..."
            />

            <div className="flex justify-between items-center px-2">
              <div className="flex gap-4 items-center">
                 <p className="text-sm font-bold text-[var(--muted)]">已選取 <span className="text-[var(--accent)]">{activeIndices.length}</span> / {results.length} 字</p>
                 <div className="h-4 w-[1px] bg-[var(--border)]" />
                 <div className="flex gap-2">
                    {PAPERS.map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => setPaper(p)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${paper.id === p.id ? 'border-[var(--accent)] scale-110' : 'border-transparent opacity-50'}`}
                        style={{ backgroundColor: p.color === 'transparent' ? '#333' : p.color }}
                        title={p.name}
                      />
                    ))}
                 </div>
              </div>
              <button onClick={() => setActiveIndices(activeIndices.length === results.length ? [] : results.map((_,i)=>i))} className="text-xs font-bold px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
                 {activeIndices.length === results.length ? "取消全選" : "全選 (Select All)"}
              </button>
            </div>

            {/* THE CANVAS */}
            <div 
              ref={canvasRef}
              style={{ backgroundColor: paper.color }}
              className={`rounded-3xl min-h-[400px] border border-[var(--border)] shadow-inner flex flex-wrap gap-6 justify-center items-center p-12 transition-all duration-500 relative ${loading ? 'opacity-60' : ''}`}
            >
              {results.map((res, idx) => {
                const s = composition[idx] || { imgIdx: 0, grid: 'none', invert: false, wireframe: false, removeBg: false };
                const currentImg = res.images?.[s.imgIdx] || res.images?.[0];
                const isSelected = activeIndices.includes(idx);
                
                return (
                  <div key={idx} onClick={(e) => handleCharClick(idx, e)} className={`relative cursor-pointer transition-all duration-300 rounded-xl ${isSelected ? 'scale-110 z-10 ring-2 ring-[var(--accent)] ring-offset-8 ring-offset-transparent' : 'opacity-90'}`}>
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
           <h2 className="text-xl font-bold">控制台</h2>
           <button onClick={() => setPickerOpen(false)} className="text-2xl">»</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
           {/* Section 1: Styles */}
           <div className="grid grid-cols-3 gap-2">
             {STYLES.map(s => (
               <button key={s.slug} onClick={() => setSelectedStyle(s.slug)} className={`py-2 rounded-lg text-sm border transition-all ${selectedStyle === s.slug ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{s.nameZh}</button>
             ))}
           </div>

           {/* Section 2: Character Editor */}
           {activeIndices.length > 0 && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <p className="text-[10px] uppercase font-bold text-[var(--accent)]">編輯模式: {activeIndices.length === 1 ? results[activeIndices[0]].character : "批量"}</p>
                
                {/* Thumbnails */}
                {activeIndices.length === 1 && results[activeIndices[0]]?.images?.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {results[activeIndices[0]].images.map((img: any, i: number) => (
                      <button key={i} onClick={() => updateActiveCharsSetting('imgIdx', i)} className={`w-16 h-16 flex-shrink-0 rounded-lg border-2 overflow-hidden bg-white ${getSetting('imgIdx') === i ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
                        <img src={img.imageUrl} className="w-full h-full object-contain filter grayscale" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => updateActiveCharsSetting('grid', getSetting('grid') === 'mi' ? 'none' : 'mi')} className={`py-3 rounded-xl border text-xs font-bold ${getSetting('grid') === 'mi' ? 'bg-[var(--accent)] text-[var(--background)]' : 'bg-[var(--card-bg)] border-[var(--border)]'}`}>米字格</button>
                   <button onClick={() => updateActiveCharsSetting('grid', getSetting('grid') === 'jiu' ? 'none' : 'jiu')} className={`py-3 rounded-xl border text-xs font-bold ${getSetting('grid') === 'jiu' ? 'bg-[var(--accent)] text-[var(--background)]' : 'bg-[var(--card-bg)] border-[var(--border)]'}`}>九宮格</button>
                   <button onClick={() => updateActiveCharsSetting('invert', !getSetting('invert'))} className={`py-3 rounded-xl border text-xs font-bold ${getSetting('invert') ? 'bg-white text-black' : 'bg-[var(--card-bg)]'}`}>反色 (拓片)</button>
                   <button onClick={() => updateActiveCharsSetting('wireframe', !getSetting('wireframe'))} className={`py-3 rounded-xl border text-xs font-bold ${getSetting('wireframe') ? 'bg-blue-600 text-white' : 'bg-[var(--card-bg)]'}`}>骨架 (線稿)</button>
                </div>
                <button onClick={() => updateActiveCharsSetting('removeBg', !getSetting('removeBg'))} className={`w-full py-4 rounded-xl border font-bold text-sm ${getSetting('removeBg') ? 'bg-[var(--accent)] text-[var(--background)]' : 'bg-[var(--card-bg)] border-[var(--border)]'}`}>一鍵去底 (顯示透視背景)</button>
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