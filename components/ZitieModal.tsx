"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { useImageRetry } from "@/lib/useImageRetry";

const PAPERS = [
  { id: "white", name: "純白", color: "#ffffff" },
  { id: "xuan", name: "生宣", color: "#fcfaf2" },
  { id: "gold", name: "金箋", color: "#e6d5a7" },
];

type GridType = "mi" | "jiu" | "none";
type ReferenceMode = "first-col" | "first-cell" | "alternating" | "empty";
type SideTab = "版面" | "格線" | "樣式";

interface ImageOption {
  id: number;
  imageUrl: string;
  calligrapherName: string | null;
  workName: string | null;
}

interface ZitieModalProps {
  char: string;
  images: ImageOption[];
  initialImageId?: number;
  onClose: () => void;
}

function GridOverlay({ type }: { type: GridType }) {
  if (type === "none") return null;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      style={{ opacity: 0.55 }}
    >
      <rect width="100" height="100" fill="none" stroke="#8b0000" strokeWidth="0.8" />
      {type === "jiu" ? (
        <>
          <line x1="33.3" y1="0" x2="33.3" y2="100" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
          <line x1="66.6" y1="0" x2="66.6" y2="100" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
          <line x1="0" y1="33.3" x2="100" y2="33.3" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
          <line x1="0" y1="66.6" x2="100" y2="66.6" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
        </>
      ) : (
        <>
          <line x1="50" y1="0" x2="50" y2="100" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
          <line x1="0" y1="0" x2="100" y2="100" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
          <line x1="100" y1="0" x2="0" y2="100" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
        </>
      )}
    </svg>
  );
}

function isReference(idx: number, cols: number, mode: ReferenceMode): boolean {
  if (mode === "empty") return false;
  if (mode === "first-cell") return idx === 0;
  if (mode === "first-col") return idx % cols === 0;
  if (mode === "alternating") return idx % 2 === 0;
  return false;
}

const SIDE_TABS: SideTab[] = ["版面", "格線", "樣式"];

export default function ZitieModal({ char, images, initialImageId, onClose }: ZitieModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(initialImageId ?? images[0]?.id);
  const [gridType, setGridType] = useState<GridType>("mi");
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(4);
  const [refMode, setRefMode] = useState<ReferenceMode>("first-col");
  const [guideOpacity, setGuideOpacity] = useState(15);
  const [removeBg, setRemoveBg] = useState(true);
  const [paper, setPaper] = useState(PAPERS[0]);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Sidebar / bottom sheet state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SideTab>("版面");

  const cellSize = 120;
  const selectedImage = images.find((i) => i.id === selectedId) ?? images[0];
  const { status: imgStatus, src: imgSrc, onLoad: onImgLoad, onError: onImgError } =
    useImageRetry(selectedImage?.imageUrl ?? "", "cors=1");
  const totalCells = cols * rows;

  const captureImage = async () => {
    if (!sheetRef.current) throw new Error("no ref");
    return toPng(sheetRef.current, {
      pixelRatio: 3,
      backgroundColor: paper.color,
      width: sheetRef.current.scrollWidth,
      height: sheetRef.current.scrollHeight,
      style: { transform: "none" },
    });
  };

  const handleExportPng = async () => {
    setExporting(true);
    try {
      const dataUrl = await captureImage();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `zitie-${char}-${Date.now()}.png`;
      a.click();
    } catch {
      alert("匯出失敗，請確保圖片允許跨域訪問。");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const dataUrl = await captureImage();
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => { img.onload = res; });
      const pxW = img.naturalWidth;
      const pxH = img.naturalHeight;
      const orientation = pxW > pxH ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [pxW, pxH] });
      pdf.addImage(dataUrl, "PNG", 0, 0, pxW, pxH);
      pdf.save(`zitie-${char}-${Date.now()}.pdf`);
    } catch {
      alert("PDF 匯出失敗，請確保圖片允許跨域訪問。");
    } finally {
      setExportingPdf(false);
    }
  };

  const busy = exporting || exportingPdf;

  // ── Tab content (shared between sidebar and mobile sheet) ──

  const layoutContent = (
    <div className="space-y-5 p-4">
      <div>
        <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">欄數: {cols}</p>
        <input
          type="range" min={2} max={8} value={cols}
          onChange={(e) => setCols(+e.target.value)}
          className="w-full accent-[var(--accent)]"
        />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">行數: {rows}</p>
        <input
          type="range" min={2} max={8} value={rows}
          onChange={(e) => setRows(+e.target.value)}
          className="w-full accent-[var(--accent)]"
        />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">示範方式</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["first-col", "首欄示範"],
            ["first-cell", "首格示範"],
            ["alternating", "隔格示範"],
            ["empty", "純空格"],
          ] as [ReferenceMode, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setRefMode(id)}
              className={`py-2.5 rounded-xl border text-sm font-bold ${refMode === id ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {refMode !== "empty" && (
        <div>
          <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">描紅濃度: {guideOpacity}%</p>
          <input
            type="range" min={0} max={35} value={guideOpacity}
            onChange={(e) => setGuideOpacity(+e.target.value)}
            className="w-full accent-[var(--accent)]"
          />
        </div>
      )}
    </div>
  );

  const gridContent = (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">格線類型</p>
        <div className="grid grid-cols-3 gap-2">
          {([ ["mi", "米字格"], ["jiu", "九宮格"], ["none", "無格"] ] as [GridType, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setGridType(id)}
              className={`py-2.5 rounded-xl border text-sm font-bold ${gridType === id ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const styleContent = (
    <div className="space-y-5 p-4">
      {images.length > 1 && (
        <div>
          <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">選擇字樣</p>
          <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => setSelectedId(img.id)}
                className={`aspect-square bg-white rounded-lg border-2 overflow-hidden ${
                  selectedId === img.id
                    ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                    : "border-transparent"
                }`}
              >
                <img src={img.imageUrl} className="w-full h-full object-contain grayscale" alt="" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">紙張</p>
        <div className="flex gap-3 items-center">
          {PAPERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPaper(p)}
              title={p.name}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${paper.id === p.id ? "border-[var(--accent)] scale-110" : "border-[var(--border)]"}`}
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">去底</p>
        <button
          onClick={() => setRemoveBg((v) => !v)}
          className={`w-full py-2.5 rounded-xl border text-sm font-bold transition-colors ${removeBg ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"}`}
        >
          {removeBg ? "一鍵去底 ✓" : "一鍵去底（已關閉）"}
        </button>
        <p className="text-[10px] text-[var(--muted)] mt-2 leading-relaxed">
          {removeBg
            ? "深色底圖（如深黃、紅底）效果可能較差，可關閉"
            : "開啟後自動去除背景，僅保留墨色筆跡"}
        </p>
      </div>
    </div>
  );

  const allTabContent = (
    <>
      <div className={activeTab === "版面" ? "" : "hidden"}>{layoutContent}</div>
      <div className={activeTab === "格線" ? "" : "hidden"}>{gridContent}</div>
      <div className={activeTab === "樣式" ? "" : "hidden"}>{styleContent}</div>
    </>
  );

  const tabActiveOptions: Record<SideTab, boolean> = {
    "版面": false,
    "格線": false,
    "樣式": removeBg,
  };

  const tabBar = (isDesktop: boolean) => (
    <div className={`flex ${isDesktop ? "border-b border-[var(--border)]" : "border-t border-[var(--border)]"}`}>
      {SIDE_TABS.map((tab) => {
        const isActive = activeTab === tab;
        const hasActive = tabActiveOptions[tab];
        const onClick = isDesktop
          ? () => setActiveTab(tab)
          : () => {
              if (tab === activeTab) { setSheetOpen((o) => !o); }
              else { setActiveTab(tab); setSheetOpen(true); }
            };
        return (
          <button
            key={tab}
            onClick={onClick}
            className={`flex-1 py-3 text-sm font-bold transition-colors relative ${isActive ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            {tab}
            {hasActive && !isActive && (
              <span className="absolute top-2 right-[calc(50%-18px)] w-1.5 h-1.5 rounded-full bg-[var(--accent)] opacity-70" />
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
    <div className="fixed inset-0 z-[60] flex bg-[var(--background)] text-[var(--foreground)]">

      {/* ── MAIN COLUMN ── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              ✕
            </button>
            <h2 className="font-display text-xl md:text-2xl text-[var(--accent)]">生成字帖 · {char}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={busy || !selectedImage}
              className="border border-[var(--accent)] text-[var(--accent)] px-3 py-1.5 rounded-xl font-bold text-sm hover:scale-105 transition-all disabled:opacity-40"
            >
              {exportingPdf ? "匯出中..." : "PDF"}
            </button>
            <button
              onClick={handleExportPng}
              disabled={busy || !selectedImage}
              className="bg-[var(--accent)] text-[var(--background)] px-4 py-1.5 rounded-xl font-bold text-sm shadow-md hover:scale-105 transition-all disabled:opacity-60"
            >
              {exporting ? "匯出中..." : "匯出字帖"}
            </button>
          </div>
        </div>

        {/* Sheet preview */}
        <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-10 flex justify-center items-start">
          <div
            ref={sheetRef}
            style={{
              display: "inline-grid",
              gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
              backgroundColor: paper.color,
              gap: 0,
            }}
          >
            <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
              <defs>
                <filter id="zitie-ink" colorInterpolationFilters="sRGB">
                  <feFlood floodColor="white" result="whiteBG" />
                  <feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
                  <feColorMatrix in="cleanImage" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 -1 -1 1 1" result="alpha" />
                  <feComponentTransfer in="alpha">
                    <feFuncA type="linear" slope="4" intercept="-2.8" />
                    <feFuncR type="linear" slope="0" intercept="0" />
                    <feFuncG type="linear" slope="0" intercept="0" />
                    <feFuncB type="linear" slope="0" intercept="0" />
                  </feComponentTransfer>
                </filter>
              </defs>
            </svg>

            {Array.from({ length: totalCells }).map((_, idx) => {
              const ref = isReference(idx, cols, refMode);
              const showImage = !!selectedImage && (ref || refMode !== "empty");
              const imgOpacity = ref ? 1 : guideOpacity / 100;
              const imgFilter = removeBg
                ? "url(#zitie-ink)"
                : "grayscale(1) contrast(200%) brightness(110%)";

              return (
                <div
                  key={idx}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    position: "relative",
                    overflow: "hidden",
                    backgroundColor: paper.color,
                  }}
                >
                  {showImage && imgStatus !== "failed" && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ padding: "8%", opacity: imgOpacity }}
                    >
                      {imgStatus === "loading" && (
                        <div className="absolute inset-[8%] rounded-md bg-[var(--border)]/30 animate-pulse" aria-hidden="true" />
                      )}
                      <img
                        src={imgSrc}
                        alt={char}
                        crossOrigin="anonymous"
                        onLoad={onImgLoad}
                        onError={onImgError}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                          filter: imgFilter,
                          opacity: imgStatus === "loaded" ? 1 : 0,
                          transition: "opacity 200ms",
                        }}
                      />
                    </div>
                  )}
                  <GridOverlay type={gridType} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── MOBILE BOTTOM SHEET ── */}
        <div className="md:hidden shrink-0 border-t border-[var(--border)] bg-[var(--background)]">
          {sheetOpen && (
            <div className="h-[260px] overflow-y-auto custom-scrollbar">
              {allTabContent}
            </div>
          )}
          {tabBar(false)}
        </div>
      </main>

      {/* ── DESKTOP SIDEBAR HANDLE ── */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 bg-[var(--card-bg)] border border-[var(--border)] border-r-0 p-2 pl-3 rounded-l-xl z-40 hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all flex-col items-center gap-1"
        >
          <span className="text-xl">«</span>
          <span className="text-[10px] [writing-mode:vertical-lr] font-bold tracking-widest">控制台</span>
        </button>
      )}

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className={`
        hidden md:flex flex-col
        bg-[var(--background)] border-l border-[var(--border)]
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? "w-[320px]" : "w-0 overflow-hidden"}
      `}>
        <div className="shrink-0 px-5 py-4 border-b border-[var(--border)] bg-[var(--card-bg)] flex items-center justify-between">
          <h2 className="font-bold text-base">字帖控制台</h2>
          <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 rounded-full bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-base hover:border-[var(--accent)] transition-colors">»</button>
        </div>
        <div className="shrink-0">{tabBar(true)}</div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">{allTabContent}</div>
      </aside>
    </div>
  );
}
