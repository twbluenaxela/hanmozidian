"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useImageRetry } from "@/lib/useImageRetry";

const PAPERS = [
  { id: "white", name: "純白", color: "#ffffff" },
  { id: "xuan", name: "生宣", color: "#fcfaf2" },
  { id: "gold", name: "金箋", color: "#e6d5a7" },
];

type GridType = "mi" | "jiu" | "none";
type ReferenceMode = "first-col" | "first-cell" | "alternating" | "empty";

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

export default function ZitieModal({ char, images, initialImageId, onClose }: ZitieModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(initialImageId ?? images[0]?.id);
  const [gridType, setGridType] = useState<GridType>("mi");
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(4);
  const [refMode, setRefMode] = useState<ReferenceMode>("first-col");
  const [guideOpacity, setGuideOpacity] = useState(15);
  const [removeBg, setRemoveBg] = useState(false);
  const [paper, setPaper] = useState(PAPERS[0]);
  const [exporting, setExporting] = useState(false);

  const cellSize = 120;
  const selectedImage = images.find((i) => i.id === selectedId) ?? images[0];
  const { status: imgStatus, src: imgSrc, onLoad: onImgLoad, onError: onImgError } =
    useImageRetry(selectedImage?.imageUrl ?? "", "cors=1");
  const totalCells = cols * rows;

  const handleExport = async () => {
    if (!sheetRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(sheetRef.current, {
        pixelRatio: 3,
        backgroundColor: paper.color,
        width: sheetRef.current.scrollWidth,
        height: sheetRef.current.scrollHeight,
        style: { transform: "none" },
      });
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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card-bg)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ✕
          </button>
          <h2 className="font-display text-lg md:text-xl text-[var(--accent)]">生成字帖 · {char}</h2>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || !selectedImage}
          className="bg-[var(--accent)] text-[var(--background)] px-4 md:px-8 py-2 rounded-xl font-bold text-sm hover:scale-105 transition-all disabled:opacity-40"
        >
          {exporting ? "匯出中..." : "匯出字帖"}
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Controls panel */}
        <div className="shrink-0 md:w-72 border-b md:border-b-0 md:border-r border-[var(--border)] overflow-y-auto custom-scrollbar p-4 space-y-5">

          {/* Image picker */}
          {images.length > 1 && (
            <div>
              <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">選擇字樣</p>
              <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar">
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
                    <img
                      src={img.imageUrl}
                      className="w-full h-full object-contain grayscale"
                      alt=""
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grid type */}
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">格線</p>
            <div className="grid grid-cols-3 gap-2">
              {([ ["mi", "米字格"], ["jiu", "九宮格"], ["none", "無格"] ] as [GridType, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setGridType(id)}
                  className={`py-2 rounded-lg border text-xs ${
                    gridType === id ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Columns & Rows */}
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">版面</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted)] w-16 shrink-0">欄數: {cols}</span>
                <input
                  type="range" min={2} max={8} value={cols}
                  onChange={(e) => setCols(+e.target.value)}
                  className="flex-1 accent-[var(--accent)]"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted)] w-16 shrink-0">行數: {rows}</span>
                <input
                  type="range" min={2} max={8} value={rows}
                  onChange={(e) => setRows(+e.target.value)}
                  className="flex-1 accent-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          {/* Reference mode */}
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
                  className={`py-2 rounded-lg border text-xs ${
                    refMode === id ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Guide opacity — only relevant when non-reference cells show the image */}
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

          {/* Remove background */}
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">去底</p>
            <button
              onClick={() => setRemoveBg((v) => !v)}
              className={`w-full py-2 rounded-lg border text-xs font-bold transition-colors ${
                removeBg ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"
              }`}
            >
              {removeBg ? "一鍵去底 ✓" : "一鍵去底"}
            </button>
          </div>

          {/* Paper */}
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">紙張</p>
            <div className="flex gap-3 items-center">
              {PAPERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPaper(p)}
                  title={p.name}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    paper.id === p.id ? "border-[var(--accent)] scale-110" : "border-[var(--border)]"
                  }`}
                  style={{ backgroundColor: p.color }}
                />
              ))}
            </div>
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
            {/* SVG filter for removeBg — defined once, referenced by all cells */}
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
                  <GridOverlay type={gridType} />
                  {showImage && imgStatus !== "failed" && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ padding: "8%", opacity: imgOpacity }}
                    >
                      {imgStatus === "loading" && (
                        <div
                          className="absolute inset-[8%] rounded-md bg-[var(--border)]/30 animate-pulse"
                          aria-hidden="true"
                        />
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
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
