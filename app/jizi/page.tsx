"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import JiziPicker from "@/components/JiziPicker";
import CalligraphyCharacter from "@/components/CalligraphyCharacter";
import { resolveCurrentImage } from "@/lib/utils";
import { useImageRetry } from "@/lib/useImageRetry";
import { toPng } from "html-to-image";
import { useAuth } from "@/lib/auth-context";
import { saveJizi, JIZI_LOAD_KEY } from "@/lib/savedJizi";

const STYLES = [
  { slug: "jinwen", nameZh: "金文" },
  { slug: "zhuan", nameZh: "小篆" },
  { slug: "li", nameZh: "隸書" },
  { slug: "kai", nameZh: "楷書" },
  { slug: "xing", nameZh: "行書" },
  { slug: "cao", nameZh: "草書" },
];

const PAPERS = [
  { id: "transparent", name: "透明", color: "transparent" },
  { id: "white", name: "純白", color: "#ffffff" },
  { id: "xuan", name: "生宣", color: "#fcfaf2" },
  { id: "gold", name: "金箋", color: "#e6d5a7" },
];

const BORDER_COLORS = ["#d4af37", "#8b0000", "#000000", "#333333", "#e5e7eb"];

const GRID_SIZES = [
  { label: "小", value: 80 },
  { label: "中", value: 120 },
  { label: "大", value: 160 },
  { label: "特大", value: 200 },
];

const GAP_SIZES = [
  { label: "無", value: 0 },
  { label: "小", value: 8 },
  { label: "中", value: 16 },
  { label: "大", value: 32 },
];

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
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
};

type BottomTab = "layout" | "style" | "filter";

const DEFAULT_SETTINGS: CompositionItem = {
  selectedImageId: undefined,
  grid: "none",
  invert: false,
  wireframe: false,
  removeBg: false,
  showBorder: true,
  borderShape: "square",
  borderWidth: 2,
  borderColor: "#d4af37",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

const TAB_LABELS: [BottomTab, string][] = [
  ["layout", "版面"],
  ["style", "字形"],
  ["filter", "篩選"],
];

function GalleryThumb({ imageUrl }: { imageUrl: string }) {
  const { status, src, onLoad, onError } = useImageRetry(imageUrl, "gallery=1");
  if (status === "failed") return null;
  return (
    <>
      {status === "loading" && (
        <div className="absolute inset-0 rounded-md bg-[var(--border)]/30 animate-pulse" aria-hidden="true" />
      )}
      <img
        src={src}
        onLoad={onLoad}
        onError={onError}
        className="w-full h-full object-contain grayscale transition-opacity duration-200"
        style={{ opacity: status === "loaded" ? 1 : 0 }}
        alt=""
      />
    </>
  );
}

export default function JiziPage() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("kai");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [paper, setPaper] = useState(PAPERS[0]);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [gridSize, setGridSize] = useState(120);
  const [gap, setGap] = useState(16);

  // Desktop sidebar
  const [pickerOpen, setPickerOpen] = useState(false);
  // Mobile bottom sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  // Shared active tab (defaults to style so sidebar always shows something useful)
  const [activeTab, setActiveTab] = useState<BottomTab>("style");

  const canvasRef = useRef<HTMLDivElement>(null);
  const [activeIndices, setActiveIndices] = useState<number[]>([]);
  const lastClickedIndex = useRef<number | null>(null);

  const [selectedCalligraphers, setSelectedCalligraphers] = useState<number[]>([]);
  const [selectedWorks, setSelectedWorks] = useState<number[]>([]);
  const [composition, setComposition] = useState<Record<number, CompositionItem>>({});

  const isComposing = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(JIZI_LOAD_KEY);
    if (!raw) return;
    sessionStorage.removeItem(JIZI_LOAD_KEY);
    try {
      const data = JSON.parse(raw);
      if (data.text) setText(data.text);
      if (data.style) setSelectedStyle(data.style);
      if (data.calligraphers) setSelectedCalligraphers(data.calligraphers);
      if (data.works) setSelectedWorks(data.works);
      if (data.orientation) setOrientation(data.orientation);
      if (data.gridSize) setGridSize(data.gridSize);
      if (data.gap !== undefined) setGap(data.gap);
      if (data.paperId) {
        const p = PAPERS.find((p) => p.id === data.paperId);
        if (p) setPaper(p);
      }
      if (data.composition) {
        const comp: Record<number, CompositionItem> = {};
        for (const [k, v] of Object.entries(data.composition)) {
          comp[Number(k)] = v as CompositionItem;
        }
        setComposition(comp);
      }
    } catch {
      // ignore malformed data
    }
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveMessage(null);
    let thumbnail: string | undefined;
    if (canvasRef.current) {
      try {
        thumbnail = await toPng(canvasRef.current, {
          pixelRatio: 1,
          backgroundColor: paper.color === "transparent" ? "#ffffff" : paper.color,
          width: canvasRef.current.scrollWidth,
          height: canvasRef.current.scrollHeight,
          style: { transform: "none" },
        });
      } catch { /* optional */ }
    }
    const { error } = await saveJizi(user.uid, {
      text, style: selectedStyle, calligraphers: selectedCalligraphers,
      works: selectedWorks, orientation, gridSize, gap, paperId: paper.id,
      composition: composition as Record<string, unknown>, thumbnail,
    });
    setIsSaving(false);
    setSaveMessage(error ?? "已儲存");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value.replace(/[\u200B-\u200D\uFEFF]/g, ""));
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;
    setIsSharing(true);
    const prevSelection = [...activeIndices];
    setActiveIndices([]);
    setSheetOpen(false);
    setPickerOpen(false);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const dataUrl = await toPng(canvasRef.current, {
        pixelRatio: 3,
        backgroundColor: paper.color === "transparent" ? undefined : paper.color,
        width: canvasRef.current.scrollWidth,
        height: canvasRef.current.scrollHeight,
        style: { transform: "none" },
      });
      const blob = await (await fetch(dataUrl)).blob();
      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setShareMessage("已複製");
        setTimeout(() => setShareMessage(null), 2000);
      } else {
        setShareMessage("不支援複製");
        setTimeout(() => setShareMessage(null), 2000);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        alert("分享失敗");
        console.error(err);
      }
    } finally {
      setActiveIndices(prevSelection);
      setIsSharing(false);
    }
  };

  const handleExport = async () => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    const prevSelection = [...activeIndices];
    setActiveIndices([]);
    setSheetOpen(false);
    setPickerOpen(false);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const dataUrl = await toPng(canvasRef.current, {
        pixelRatio: 3,
        backgroundColor: paper.color === "transparent" ? undefined : paper.color,
        width: canvasRef.current.scrollWidth,
        height: canvasRef.current.scrollHeight,
        style: { transform: "none" },
      });
      const link = document.createElement("a");
      link.download = `hanmo-${Date.now()}.png`;
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
      setActiveIndices((p) => (p.includes(idx) ? p.filter((i) => i !== idx) : [...p, idx]));
    } else {
      setActiveIndices([idx]);
      setActiveTab("style");
      setSheetOpen(true);   // mobile
      setPickerOpen(true);  // desktop
    }
    lastClickedIndex.current = idx;
  };

  const updateActiveCharsSetting = (key: keyof CompositionItem, val: any) => {
    setComposition((prev) => {
      const next = { ...prev };
      activeIndices.forEach((idx) => {
        next[idx] = { ...(next[idx] || { ...DEFAULT_SETTINGS }), [key]: val };
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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.trim() && !isComposing.current) handleCompose();
    }, 400);
    return () => clearTimeout(timer);
  }, [text, selectedStyle, selectedCalligraphers, selectedWorks, handleCompose]);

  const hasFilters = selectedCalligraphers.length > 0 || selectedWorks.length > 0;

  // ── Shared tab content (rendered in both mobile sheet and desktop sidebar) ──

  const layoutContent = (
    <div className="space-y-5 p-4">
      <div>
        <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">排版方向</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setOrientation("horizontal")} className={`py-2.5 rounded-xl border text-sm font-bold ${orientation === "horizontal" ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"}`}>橫排</button>
          <button onClick={() => setOrientation("vertical")} className={`py-2.5 rounded-xl border text-sm font-bold ${orientation === "vertical" ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"}`}>直排</button>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">字格大小</p>
        <div className="grid grid-cols-4 gap-2">
          {GRID_SIZES.map((g) => (
            <button key={g.value} onClick={() => setGridSize(g.value)} className={`py-2.5 rounded-xl border text-sm font-bold ${gridSize === g.value ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"}`}>{g.label}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">字間距</p>
        <div className="grid grid-cols-4 gap-2">
          {GAP_SIZES.map((g) => (
            <button key={g.value} onClick={() => setGap(g.value)} className={`py-2.5 rounded-xl border text-sm font-bold ${gap === g.value ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"}`}>{g.label}</button>
          ))}
        </div>
      </div>
    </div>
  );

  const styleContent = (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">書體</p>
        <div className="grid grid-cols-6 gap-1.5">
          {STYLES.map((s) => (
            <button key={s.slug} onClick={() => setSelectedStyle(s.slug)} className={`py-2 rounded-lg text-xs border ${selectedStyle === s.slug ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"}`}>{s.nameZh}</button>
          ))}
        </div>
      </div>

      {activeIndices.length === 0 ? (
        <p className="text-center text-sm text-[var(--muted)] py-6">點擊畫布上的字以調整字形</p>
      ) : (
        <>
          {activeIndices.length === 1 && results[activeIndices[0]]?.images?.length > 1 && (
            <div>
              <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">替換版本</p>
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                {results[activeIndices[0]].images.map((img: any) => (
                  <button
                    key={img.id}
                    onClick={() => {
                      const targetIdx = activeIndices[0];
                      setComposition((prev) => ({
                        ...prev,
                        [targetIdx]: { ...(prev[targetIdx] || DEFAULT_SETTINGS), selectedImageId: img.id },
                      }));
                    }}
                    className={`relative shrink-0 w-14 h-14 bg-white rounded-lg border-2 overflow-hidden ${String(composition[activeIndices[0]]?.selectedImageId) === String(img.id) ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30" : "border-transparent"}`}
                  >
                    <GalleryThumb imageUrl={img.imageUrl} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-[var(--accent)]">邊框</p>
            <div className="flex gap-2">
              <button onClick={() => updateActiveCharsSetting("showBorder", !getSetting("showBorder"))} className={`flex-1 py-2 rounded-lg border text-xs ${getSetting("showBorder") ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"}`}>
                {getSetting("showBorder") ? "隱藏邊框" : "顯示邊框"}
              </button>
              <button onClick={() => updateActiveCharsSetting("borderShape", getSetting("borderShape") === "circle" ? "square" : "circle")} className="flex-1 py-2 rounded-lg border text-xs border-[var(--border)]">
                {getSetting("borderShape") === "circle" ? "切換方形" : "切換圓形"}
              </button>
            </div>
            {getSetting("showBorder") && (
              <div className="flex gap-2 items-center pt-1">
                {BORDER_COLORS.map((c) => (
                  <button key={c} onClick={() => updateActiveCharsSetting("borderColor", c)} className={`w-6 h-6 rounded-full border-2 ${getSetting("borderColor") === c ? "border-[var(--accent)]" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-[var(--accent)]">效果</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => updateActiveCharsSetting("grid", getSetting("grid") === "mi" ? "none" : "mi")} className={`py-2 rounded-xl border text-xs ${getSetting("grid") === "mi" ? "bg-[var(--accent)] text-[var(--background)]" : "bg-[var(--card-bg)]"}`}>米字格</button>
              <button onClick={() => updateActiveCharsSetting("grid", getSetting("grid") === "jiu" ? "none" : "jiu")} className={`py-2 rounded-xl border text-xs ${getSetting("grid") === "jiu" ? "bg-[var(--accent)] text-[var(--background)]" : "bg-[var(--card-bg)]"}`}>九宮格</button>
              <button onClick={() => updateActiveCharsSetting("invert", !getSetting("invert"))} className={`py-2 rounded-xl border text-xs ${getSetting("invert") ? "bg-white text-black" : "bg-[var(--card-bg)]"}`}>反色 (拓片)</button>
              <button onClick={() => updateActiveCharsSetting("wireframe", !getSetting("wireframe"))} className={`py-2 rounded-xl border text-xs ${getSetting("wireframe") ? "bg-blue-600 text-white" : "bg-[var(--card-bg)]"}`}>骨架 (線稿)</button>
            </div>
            <button onClick={() => updateActiveCharsSetting("removeBg", !getSetting("removeBg"))} className={`w-full py-2.5 rounded-xl border text-xs font-bold ${getSetting("removeBg") ? "bg-[var(--accent)] text-[var(--background)]" : "bg-[var(--card-bg)]"}`}>一鍵去底</button>
          </div>
        </>
      )}
    </div>
  );

  // JiziPicker stays mounted at all times to avoid re-fetching when switching tabs.
  // We render all three panels and use CSS to hide inactive ones.
  const allTabContent = (
    <>
      <div className={activeTab === "layout" ? "" : "hidden"}>{layoutContent}</div>
      <div className={activeTab === "style" ? "" : "hidden"}>{styleContent}</div>
      <div className={activeTab === "filter" ? "p-4" : "hidden"}>
        <JiziPicker
          text={text} style={selectedStyle} open={true}
          selectedCalligraphers={selectedCalligraphers} selectedWorks={selectedWorks}
          onToggleCalligrapher={(id) => setSelectedCalligraphers((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])}
          onToggleWork={(id) => setSelectedWorks((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])}
          onReset={() => { setSelectedCalligraphers([]); setSelectedWorks([]); }}
        />
      </div>
    </>
  );

  const tabBar = (isDesktop: boolean) => (
    <div className={`flex ${isDesktop ? "border-b border-[var(--border)]" : "border-t border-[var(--border)]"}`}>
      {TAB_LABELS.map(([tab, label]) => {
        const isActive = activeTab === tab;
        const onClick = isDesktop
          ? () => setActiveTab(tab)
          : () => { if (tab === activeTab) { setSheetOpen((o) => !o); } else { setActiveTab(tab); setSheetOpen(true); } };
        return (
          <button
            key={tab}
            onClick={onClick}
            className={`flex-1 py-3 text-sm font-bold transition-colors relative ${isActive ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            {label}
            {tab === "filter" && hasFilters && (
              <span className="absolute top-2 right-[calc(50%-16px)] w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            )}
            {isActive && (
              <span className={`absolute ${isDesktop ? "bottom-0" : "top-0"} left-1/4 right-1/4 h-0.5 bg-[var(--accent)] rounded-full`} />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="h-[100dvh] flex bg-[var(--background)] text-[var(--foreground)]">

      {/* ── MAIN COLUMN ── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md z-10">
          <h1 className="font-display text-xl md:text-2xl text-[var(--accent)]">集字工坊</h1>
          <div className="flex items-center gap-2">
            {user && (
              <div className="relative">
                <button onClick={handleSave} disabled={isSaving || !text.trim()} className="border border-[var(--accent)] text-[var(--accent)] px-3 py-1.5 rounded-xl font-bold text-sm hover:scale-105 transition-all disabled:opacity-40">
                  {isSaving ? "儲存中..." : "存入我的"}
                </button>
                {saveMessage && (
                  <span className={`absolute -bottom-5 right-0 text-[10px] whitespace-nowrap ${saveMessage === "已儲存" ? "text-green-500" : "text-red-400"}`}>{saveMessage}</span>
                )}
              </div>
            )}
            <div className="relative">
              <button onClick={handleShare} disabled={isSharing || isExporting} className="border border-[var(--accent)] text-[var(--accent)] px-3 py-1.5 rounded-xl font-bold text-sm hover:scale-105 transition-all disabled:opacity-40">
                {isSharing ? "複製中..." : "分享"}
              </button>
              {shareMessage && (
                <span className="absolute -bottom-5 right-0 text-[10px] whitespace-nowrap text-green-500">{shareMessage}</span>
              )}
            </div>
            <button onClick={handleExport} disabled={isExporting || isSharing} className="bg-[var(--accent)] text-[var(--background)] px-4 py-1.5 rounded-xl font-bold text-sm shadow-md hover:scale-105 transition-all disabled:opacity-60">
              {isExporting ? "匯出中..." : "匯出作品"}
            </button>
          </div>
        </div>

        {/* Text input */}
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-[var(--border)] space-y-2">
          <textarea
            value={text}
            onChange={handleTextChange}
            onCompositionStart={() => { isComposing.current = true; }}
            onCompositionEnd={() => { isComposing.current = false; }}
            rows={2}
            className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-2xl font-display focus:border-[var(--accent)] transition-all resize-none"
            placeholder="輸入漢字..."
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              {PAPERS.map((p) => (
                <button key={p.id} onClick={() => setPaper(p)} title={p.name} className={`w-5 h-5 rounded-full border-2 transition-transform ${paper.id === p.id ? "border-[var(--accent)] scale-110" : "border-transparent"}`} style={{ backgroundColor: p.color === "transparent" ? "#444" : p.color }} />
              ))}
            </div>
            <button onClick={() => setActiveIndices(activeIndices.length === results.length && results.length > 0 ? [] : results.map((_, i) => i))} className="text-xs font-bold px-3 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
              {activeIndices.length === results.length && results.length > 0 ? "取消全選" : "全選"}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div data-testid="jizi-scroll" className="flex-1 min-h-0 overflow-auto custom-scrollbar p-4 md:p-10 flex justify-center items-start">
          <div
            data-testid="jizi-canvas"
            ref={canvasRef}
            style={{
              backgroundColor: paper.color,
              display: "inline-flex", flexWrap: "wrap", flexDirection: "row",
              writingMode: orientation === "vertical" ? "vertical-rl" : "horizontal-tb",
              alignContent: "flex-start",
              justifyContent: orientation === "vertical" ? "start" : "center",
              gap: `${gap}px`,
              height: orientation === "vertical" ? "800px" : "auto",
              padding: "60px",
              width: "auto",
              maxWidth: orientation === "horizontal" ? "800px" : "none",
              minWidth: "fit-content", minHeight: "fit-content",
            }}
            className={`rounded-2xl transition-opacity duration-500 ${loading ? "opacity-50" : "opacity-100"}`}
          >
            {results.map((res, idx) => {
              const s = composition[idx] || DEFAULT_SETTINGS;
              const currentImg = resolveCurrentImage(res.images ?? [], s.selectedImageId);
              const isSelected = activeIndices.includes(idx);
              return (
                <div
                  data-testid="char-cell"
                  key={`${idx}-${res.character}`}
                  onClick={(e) => handleCharClick(idx, e)}
                  style={{ writingMode: "horizontal-tb", width: gridSize, height: gridSize, transform: `translate(${s.offsetX}px, ${s.offsetY}px) scale(${s.scale}) rotate(${s.rotation}deg)` }}
                  className={`relative cursor-pointer transition-all duration-200 flex items-center justify-center shrink-0 ${isSelected ? "z-10" : "opacity-95"}`}
                >
                  {isSelected && <div className="absolute inset-[-4px] border-2 border-[var(--accent)] rounded-xl animate-pulse pointer-events-none" />}
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

        {/* ── MOBILE BOTTOM SHEET (hidden on md+) ── */}
        <div className="md:hidden shrink-0 border-t border-[var(--border)] bg-[var(--background)]">
          {sheetOpen && (
            <div className="h-[260px] overflow-y-auto custom-scrollbar">
              {allTabContent}
            </div>
          )}
          {tabBar(false)}
        </div>

        {/* BottomNav spacer — mobile only */}
        <div className="md:hidden h-14 shrink-0" />
      </main>

      {/* ── DESKTOP SIDEBAR HANDLE (hidden on mobile) ── */}
      {!pickerOpen && (
        <button
          onClick={() => setPickerOpen(true)}
          className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 bg-[var(--card-bg)] border border-[var(--border)] border-r-0 p-2 pl-3 rounded-l-xl z-40 hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all group flex-col items-center gap-1"
        >
          <span className="text-xl">«</span>
          <span className="text-[10px] [writing-mode:vertical-lr] font-bold tracking-widest">控制台</span>
          {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] group-hover:bg-[var(--background)]" />}
        </button>
      )}

      {/* ── DESKTOP SIDEBAR (hidden on mobile) ── */}
      <aside className={`
        hidden md:flex flex-col
        bg-[var(--background)] border-l border-[var(--border)]
        transition-all duration-300 ease-in-out
        ${pickerOpen ? "w-[380px]" : "w-0 overflow-hidden"}
      `}>
        {/* Sidebar header */}
        <div className="shrink-0 px-5 py-4 border-b border-[var(--border)] bg-[var(--card-bg)] flex items-center justify-between">
          <h2 className="font-bold text-base">集字控制台</h2>
          <button onClick={() => setPickerOpen(false)} className="w-8 h-8 rounded-full bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-base hover:border-[var(--accent)] transition-colors">»</button>
        </div>

        {/* Sidebar tab bar */}
        <div className="shrink-0">
          {tabBar(true)}
        </div>

        {/* Sidebar tab content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {allTabContent}
        </div>
      </aside>
    </div>
  );
}
