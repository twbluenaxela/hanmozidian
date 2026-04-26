"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  source: "projection" | "paddle" | "manual";
  char?: string;
  page: number;
}

interface WorkData {
  identifier: string;
  name: string;
  category: string;
  calligrapher: string | null;
  era: string;
  styleSlug: string | null;
  shiwen: string | null;
  status: string;
  annotationDraft: string | null;
}

interface BoxesData {
  imageSize: { w: number; h: number };
  boxes: Array<{ x: number; y: number; w: number; h: number; confidence: number; source: string }>;
  shiwen: string[];
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

let _idSeq = 0;
function makeId() {
  return `box-${Date.now()}-${++_idSeq}`;
}

// Sort boxes globally by page only — within each page, draw order (array order) is preserved
function sortedGlobalOrder(boxes: Box[]): Box[] {
  return [...boxes].sort((a, b) => a.page - b.page);
}

function AnnotateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const identifier = searchParams.get("id") || "";

  const [renderScale, setRenderScale] = useState(1);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [work, setWork] = useState<WorkData | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [imageSize, setImageSize] = useState({ w: 1, h: 1 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shiwenChars, setShiwenChars] = useState<string[]>([]);
  const [shiwenInput, setShiwenInput] = useState("");
  const [calligrapherInput, setCalligrapherInput] = useState("");
  const [styleInput, setStyleInput] = useState("");
  const [drawMode, setDrawMode] = useState(false);
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizingRef = useRef<{
    id: string; handle: ResizeHandle;
    startX: number; startY: number;
    origX: number; origY: number; origW: number; origH: number;
  } | null>(null);
  const [, forceUpdate] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Load work data
  useEffect(() => {
    if (!identifier) return;
    fetch(`/api/admin/npm/${encodeURIComponent(identifier)}`)
      .then((r) => r.json())
      .then(({ work, boxes: boxData, pageCount: pc }: { work: WorkData; boxes: BoxesData | null; pageCount: number }) => {
        setWork(work);
        setCalligrapherInput(work.calligrapher || "");
        setStyleInput(work.styleSlug || "");
        setPageCount(pc ?? 1);

        if (work.annotationDraft) {
          const draft = JSON.parse(work.annotationDraft);
          // Backward compat: old drafts have no page field on boxes
          const migratedBoxes = (draft.boxes || []).map((b: any) => ({ ...b, page: b.page ?? 0 }));
          setBoxes(migratedBoxes);
          setShiwenChars(draft.shiwenChars || []);
          setShiwenInput(draft.shiwenChars?.join("") || work.shiwen || "");
          setImageSize(draft.imageSize || { w: 1, h: 1 });
        } else if (boxData) {
          applyBoxData(boxData);
        } else {
          setShiwenInput(work.shiwen || "");
        }
      });
  }, [identifier]);

  const applyBoxData = useCallback((boxData: BoxesData) => {
    const mapped: Box[] = boxData.boxes.map((b, i) => ({
      id: makeId(),
      x: b.x, y: b.y, w: b.w, h: b.h,
      confidence: b.confidence,
      source: b.source as Box["source"],
      char: boxData.shiwen[i] || "",
      page: 0,
    }));
    setBoxes(mapped);
    setShiwenChars(boxData.shiwen);
    handleShiwenChange(boxData.shiwen.join(""));
    setImageSize(boxData.imageSize);
  }, []);

  const runProcessing = useCallback(async () => {
    if (!identifier) return;
    setProcessing(true);
    setProcessError(null);
    try {
      const res = await fetch(`/api/admin/npm/${encodeURIComponent(identifier)}/process`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "processing failed");
      if (data.boxes) applyBoxData(data.boxes);
    } catch (e: any) {
      setProcessError(e.message);
    } finally {
      setProcessing(false);
    }
  }, [identifier, applyBoxData]);

  const handleImageLoad = useCallback(() => {
    if (!imgRef.current) return;
    const naturalWidth = imgRef.current.naturalWidth;
    const currentWidth = imgRef.current.clientWidth;
    setRenderScale(currentWidth / naturalWidth);
  }, []);

  useEffect(() => {
    if (!imgRef.current || imageSize.w === 1) return;
    const naturalScale = imgRef.current.clientWidth / imageSize.w / zoom;
    setScale(naturalScale * zoom);
  }, [zoom, imageSize.w]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(4, Math.max(0.25, z - e.deltaY * 0.001)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleImageLoad);
    return () => window.removeEventListener("resize", handleImageLoad);
  }, [handleImageLoad]);

  // Delete key shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedIds.size === 0) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      deleteSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds]);

  // Assign chars based on global sort order (page → y → x)
  const applyShiwen = useCallback((chars: string[]) => {
    setShiwenChars(chars);
    setBoxes((prev) => {
      const ordered = sortedGlobalOrder(prev);
      const charMap = new Map(ordered.map((b, i) => [b.id, chars[i] || ""]));
      return prev.map((b) => ({ ...b, char: charMap.get(b.id) || "" }));
    });
  }, []);

  const handleShiwenChange = (val: string) => {
    setShiwenInput(val);
    const chars = [...val].filter((c) => c.trim() && !["。", "，", "、", "；", "：", "「", "」", "□"].includes(c));
    applyShiwen(chars);
  };

  // Box interactions
  const handleBoxMouseDown = (e: React.MouseEvent, id: string) => {
    if (drawMode) return;
    e.stopPropagation();
    if (!e.shiftKey) {
      setSelectedIds(new Set([id]));
      setDragging({ id, startX: e.clientX, startY: e.clientY, origX: boxes.find(b => b.id === id)!.x, origY: boxes.find(b => b.id === id)!.y });
    }
    // shift+drag not supported — shift clicks are handled in onClick
  };

  // Resize handle mouse down
  const handleResizeMouseDown = (e: React.MouseEvent, id: string, handle: ResizeHandle) => {
    if (drawMode) return;
    e.stopPropagation();
    e.preventDefault();
    const box = boxes.find(b => b.id === id)!;
    resizingRef.current = {
      id, handle,
      startX: e.clientX, startY: e.clientY,
      origX: box.x, origY: box.y, origW: box.w, origH: box.h,
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (resizingRef.current) {
      const { id, handle, startX, startY, origX, origY, origW, origH } = resizingRef.current;
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      const MIN = 10;
      setBoxes((prev) => prev.map((b) => {
        if (b.id !== id) return b;
        let { x, y, w, h } = { x: origX, y: origY, w: origW, h: origH };
        if (handle.includes("e")) w = Math.max(MIN, origW + dx);
        if (handle.includes("w")) { w = Math.max(MIN, origW - dx); x = origX + origW - w; }
        if (handle.includes("s")) h = Math.max(MIN, origH + dy);
        if (handle.includes("n")) { h = Math.max(MIN, origH - dy); y = origY + origH - h; }
        return { ...b, x, y, w, h };
      }));
      forceUpdate(n => n + 1);
      return;
    }
    if (!dragging) return;
    const dx = (e.clientX - dragging.startX) / scale;
    const dy = (e.clientY - dragging.startY) / scale;
    setBoxes((prev) => prev.map((b) => b.id === dragging.id ? { ...b, x: dragging.origX + dx, y: dragging.origY + dy } : b));
  }, [dragging, scale]);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;
    setDragging(null);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Draw new box
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!drawMode) {
      setSelectedIds(new Set());
      return;
    }
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDrawing({
      x: (e.clientX - rect.left) / (zoom * renderScale),
      y: (e.clientY - rect.top) / (zoom * renderScale),
    });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (!drawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x2 = (e.clientX - rect.left) / (zoom * renderScale);
    const y2 = (e.clientY - rect.top) / (zoom * renderScale);
    const newBox: Box = {
      id: makeId(),
      x: Math.min(drawing.x, x2),
      y: Math.min(drawing.y, y2),
      w: Math.abs(x2 - drawing.x),
      h: Math.abs(y2 - drawing.y),
      confidence: 1,
      source: "manual",
      char: "",
      page: currentPage,
    };
    if (newBox.w > 5 && newBox.h > 5) {
      setBoxes((prev) => {
        const next = [...prev, newBox];
        // Re-apply shiwen to account for new box in global order
        const ordered = sortedGlobalOrder(next);
        const charMap = new Map(ordered.map((b, i) => [b.id, shiwenChars[i] || ""]));
        return next.map((b) => ({ ...b, char: charMap.get(b.id) || "" }));
      });
    }
    setDrawing(null);
  };

  const deleteBox = (id: string) => {
    setBoxes((prev) => {
      const next = prev.filter((b) => b.id !== id);
      const ordered = sortedGlobalOrder(next);
      const charMap = new Map(ordered.map((b, i) => [b.id, shiwenChars[i] || ""]));
      return next.map((b) => ({ ...b, char: charMap.get(b.id) || "" }));
    });
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  };

  const deleteSelected = () => {
    setBoxes((prev) => {
      const next = prev.filter((b) => !selectedIds.has(b.id));
      const ordered = sortedGlobalOrder(next);
      const charMap = new Map(ordered.map((b, i) => [b.id, shiwenChars[i] || ""]));
      return next.map((b) => ({ ...b, char: charMap.get(b.id) || "" }));
    });
    setSelectedIds(new Set());
  };

  const clearAllBoxes = () => {
    setBoxes([]);
    setSelectedIds(new Set());
  };

  // Save draft
  const saveDraft = useCallback(async (status = "annotating") => {
    if (!work) return;
    setSaving(true);
    const draft = { boxes, shiwenChars, imageSize };
    try {
      await fetch("/api/admin/npm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: work.identifier,
          status,
          annotationDraft: JSON.stringify(draft),
          shiwen: shiwenInput,
          calligrapher: calligrapherInput,
          styleSlug: styleInput,
        }),
      });
      setWork(prev => prev ? ({ ...prev, status }) : null);
      setSaveMsg(status === "done" ? "✓ 完成並儲存" : "✓ 草稿已儲存");
    } catch {
      setSaveMsg("⚠ 儲存失敗");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  }, [work, boxes, shiwenChars, imageSize, shiwenInput, calligrapherInput, styleInput]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!work || work.status === "done") return;
    const timer = setInterval(() => saveDraft("annotating"), 30000);
    return () => clearInterval(timer);
  }, [saveDraft, work]);

  // Global counts (all pages)
  const totalBoxes = boxes.length;
  const countMatch = totalBoxes === shiwenChars.length;
  // Single selected box (for info panel / resize handles)
  const singleSelectedBox = selectedIds.size === 1 ? boxes.find((b) => b.id === [...selectedIds][0]) : undefined;

  // Boxes on current page, with their global char index
  const globalOrdered = sortedGlobalOrder(boxes);
  const globalIndexMap = new Map(globalOrdered.map((b, i) => [b.id, i]));
  const currentPageBoxes = boxes.filter((b) => b.page === currentPage);

  // Resize handle definitions: [handle key, cursor, left%, top%]
  const HANDLES: [ResizeHandle, string, string, string][] = [
    ["nw", "nw-resize", "-4px", "-4px"],
    ["n",  "n-resize",  "calc(50% - 4px)", "-4px"],
    ["ne", "ne-resize", "calc(100% - 4px)", "-4px"],
    ["e",  "e-resize",  "calc(100% - 4px)", "calc(50% - 4px)"],
    ["se", "se-resize", "calc(100% - 4px)", "calc(100% - 4px)"],
    ["s",  "s-resize",  "calc(50% - 4px)", "calc(100% - 4px)"],
    ["sw", "sw-resize", "-4px", "calc(100% - 4px)"],
    ["w",  "w-resize",  "-4px", "calc(50% - 4px)"],
  ];

  if (!work) {
    return <div className="flex items-center justify-center h-screen text-[var(--muted)]">載入中...</div>;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--background)] text-[var(--foreground)]">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card-bg)]">
        <button onClick={() => { saveDraft(work.status === "done" ? "done" : "annotating"); router.push("/admin"); }}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-display text-base truncate">{work.name}</p>
          <p className="text-xs text-[var(--muted)]">{work.identifier} · {work.category}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Page navigation */}
          {pageCount > 1 && (
            <div className="flex items-center gap-1 border border-[var(--border)] rounded-lg overflow-hidden text-xs">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-2 py-1.5 hover:bg-[var(--card-bg)] transition-colors disabled:opacity-30">←</button>
              <span className="px-2 py-1.5 text-[var(--muted)] min-w-[4rem] text-center tabular-nums">
                頁 {currentPage + 1} / {pageCount}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage === pageCount - 1}
                className="px-2 py-1.5 hover:bg-[var(--card-bg)] transition-colors disabled:opacity-30">→</button>
            </div>
          )}
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-[var(--border)] rounded-lg overflow-hidden text-xs">
            <button onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
              className="px-2 py-1.5 hover:bg-[var(--card-bg)] transition-colors">−</button>
            <span className="px-2 py-1.5 text-[var(--muted)] min-w-[3.5rem] text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
              className="px-2 py-1.5 hover:bg-[var(--card-bg)] transition-colors">+</button>
            <button onClick={() => setZoom(1)}
              className="px-2 py-1.5 hover:bg-[var(--card-bg)] transition-colors text-[var(--muted)]">↺</button>
          </div>
          {saveMsg && <span className="text-xs text-green-400">{saveMsg}</span>}
          <button onClick={() => saveDraft("annotating")} disabled={saving}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors disabled:opacity-40">
            {saving ? "儲存中..." : "儲存草稿"}
          </button>
          <button onClick={() => { saveDraft("skipped"); router.push("/admin"); }}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--muted)] hover:border-red-400 hover:text-red-400 transition-colors">
            略過
          </button>
          <button onClick={() => saveDraft("done")} disabled={!countMatch}
            className="px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-[var(--background)] font-bold hover:scale-105 transition-all disabled:opacity-40 disabled:scale-100">
            確認完成
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">

        {/* Left panel: controls */}
        <div className="shrink-0 w-64 border-r border-[var(--border)] overflow-y-auto p-4 space-y-5">

          {/* Metadata */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase font-bold text-[var(--accent)]">後設資料</p>
            <div>
              <label className="text-xs text-[var(--muted)]">書法家</label>
              <input value={calligrapherInput} onChange={(e) => setCalligrapherInput(e.target.value)}
                className="mt-1 w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">書體 slug</label>
              <input value={styleInput} onChange={(e) => setStyleInput(e.target.value)}
                placeholder="kai / xing / cao / li / zhuan"
                className="mt-1 w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
          </div>

          {/* 釋文 */}
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-1">釋文（全卷）</p>
            <textarea
              value={shiwenInput}
              onChange={(e) => handleShiwenChange(e.target.value)}
              rows={6}
              placeholder="貼上釋文..."
              className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] resize-none font-display"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-[var(--muted)]">{shiwenChars.length} 字</p>
              <button
                onClick={() => handleShiwenChange(shiwenInput + "□")}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)] rounded px-1.5 py-0.5 font-display transition-colors"
                title="插入缺字佔位符 □ (U+25A1)">
                + □
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-[var(--card-bg)] rounded-xl p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">此頁框選</span>
              <span>{currentPageBoxes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">全卷框選</span>
              <span>{totalBoxes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">釋文字數</span>
              <span>{shiwenChars.length}</span>
            </div>
            <div className={`flex justify-between font-bold ${countMatch ? "text-green-400" : "text-yellow-400"}`}>
              <span>狀態</span>
              <span>{countMatch ? "✓ 對齊" : `差 ${Math.abs(totalBoxes - shiwenChars.length)} 字`}</span>
            </div>
          </div>

          {/* Tools */}
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">工具</p>
            <div className="space-y-2">
              <button
                onClick={() => setDrawMode((v) => !v)}
                className={`w-full py-2 rounded-lg border text-xs font-bold transition-colors ${
                  drawMode ? "bg-[var(--accent)] text-[var(--background)]" : "border-[var(--border)]"
                }`}>
                {drawMode ? "繪製模式 ✓" : "繪製新框"}
              </button>
              <button
                onClick={runProcessing}
                disabled={processing}
                className="w-full py-2 rounded-lg border border-[var(--border)] text-xs font-bold transition-colors disabled:opacity-40">
                {processing ? "偵測中..." : "偵測字框"}
              </button>
              {processError && (
                <p className="text-xs text-red-400 text-center">{processError}</p>
              )}
              {selectedIds.size > 0 && (
                <button onClick={deleteSelected}
                  className="w-full py-2 rounded-lg border border-red-400 text-red-400 text-xs font-bold hover:bg-red-400 hover:text-[var(--background)] transition-colors">
                  {selectedIds.size > 1 ? `刪除 ${selectedIds.size} 框 (Del)` : "刪除選取框 (Del)"}
                </button>
              )}
              <button onClick={clearAllBoxes}
                disabled={boxes.length === 0}
                className="w-full py-2 rounded-lg border border-[var(--border)] text-[var(--muted)] text-xs font-bold hover:border-red-400 hover:text-red-400 transition-colors disabled:opacity-30">
                清空框選
              </button>
            </div>
          </div>

          {/* Selected box info — only when exactly one box selected */}
          {singleSelectedBox && (
            <div className="bg-[var(--card-bg)] rounded-xl p-3 space-y-1 text-xs">
              <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">選取框</p>
              <div className="flex justify-between"><span className="text-[var(--muted)]">字</span><span className="font-display text-lg">{singleSelectedBox.char || "—"}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">序</span><span>#{(globalIndexMap.get(singleSelectedBox.id) ?? 0) + 1}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">來源</span><span>{singleSelectedBox.source}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">信心</span><span>{(singleSelectedBox.confidence * 100).toFixed(0)}%</span></div>
            </div>
          )}
        </div>

        {/* Right panel: image + boxes */}
        <div ref={viewportRef} className="flex-1 overflow-auto p-4 bg-[var(--background)]">
          <div
            ref={canvasRef}
            className={`relative inline-block select-none ${drawMode ? "cursor-crosshair" : "cursor-default"}`}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              maxWidth: "100%",
              maxHeight: "80vh",
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
          >
            <img
              key={`${identifier}-p${currentPage}`}
              ref={imgRef}
              src={`/api/admin/npm-image/${encodeURIComponent(identifier)}?type=clean&page=${currentPage}`}
              style={{ display: "block", maxWidth: "100%", height: "auto" }}
              alt={work.name}
              className="block"
              onLoad={handleImageLoad}
              draggable={false}
            />

            {/* Bounding boxes overlay — current page only */}
            {currentPageBoxes.map((box) => {
              const isSelected = selectedIds.has(box.id);
              const isLowConf = box.confidence < 0.5;
              const globalIdx = globalIndexMap.get(box.id) ?? 0;
              const color = isSelected ? "#e5b84a" : isLowConf ? "#f97316" : "#22c55e";
              return (
                <div
                  key={box.id}
                  onMouseDown={(e) => handleBoxMouseDown(e, box.id)}
                  style={{
                    position: "absolute",
                    left: box.x,
                    top: box.y,
                    width: box.w,
                    height: box.h,
                    border: `2px solid ${color}`,
                    boxSizing: "border-box",
                    cursor: drawMode ? "crosshair" : "move",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey) {
                      setSelectedIds((prev) => {
                        const s = new Set(prev);
                        if (s.has(box.id)) s.delete(box.id); else s.add(box.id);
                        return s;
                      });
                    } else {
                      setSelectedIds(new Set([box.id]));
                    }
                  }}
                >
                  {/* Character label */}
                  <span style={{
                    position: "absolute", top: -18, left: 0,
                    fontSize: 11, lineHeight: 1,
                    color,
                    background: "rgba(0,0,0,0.6)",
                    padding: "1px 3px", borderRadius: 2,
                    pointerEvents: "none", whiteSpace: "nowrap",
                  }}>
                    {globalIdx + 1} {box.char || "?"}
                  </span>

                  {/* Resize handles — only on the single selected box */}
                  {selectedIds.size === 1 && isSelected && HANDLES.map(([handle, cursor, left, top]) => (
                    <div
                      key={handle}
                      onMouseDown={(e) => handleResizeMouseDown(e, box.id, handle)}
                      style={{
                        position: "absolute",
                        left, top,
                        width: 8, height: 8,
                        background: "#e5b84a",
                        border: "1px solid #000",
                        borderRadius: 2,
                        cursor,
                        zIndex: 10,
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnnotatePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-[var(--muted)]">載入中...</div>}>
      <AnnotateInner />
    </Suspense>
  );
}
