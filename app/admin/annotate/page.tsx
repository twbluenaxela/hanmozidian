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

let _idSeq = 0;
function makeId() {
  return `box-${Date.now()}-${++_idSeq}`;
}

function AnnotateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const identifier = searchParams.get("id") || "";

  const [renderScale, setRenderScale] = useState(1); // Ratio of screen size to natural image size

  const canvasRef = useRef<HTMLDivElement>(null);
  const [work, setWork] = useState<WorkData | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [imageSize, setImageSize] = useState({ w: 1, h: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shiwenChars, setShiwenChars] = useState<string[]>([]);
  const [shiwenInput, setShiwenInput] = useState("");
  const [calligrapherInput, setCalligrapherInput] = useState("");
  const [styleInput, setStyleInput] = useState("");
  const [drawMode, setDrawMode] = useState(false);
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Load work data
  useEffect(() => {
    if (!identifier) return;
    fetch(`/api/admin/npm/${encodeURIComponent(identifier)}`)
      .then((r) => r.json())
      .then(({ work, boxes: boxData }: { work: WorkData; boxes: BoxesData | null }) => {
        setWork(work);
        setCalligrapherInput(work.calligrapher || "");
        setStyleInput(work.styleSlug || "");

        // Restore draft if available, otherwise use processed boxes
        if (work.annotationDraft) {
          const draft = JSON.parse(work.annotationDraft);
          setBoxes(draft.boxes || []);
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

  // Recompute scale when image loads or zoom changes
  const handleImageLoad = useCallback(() => {
    if (!imgRef.current) return;
    // This is the "secret sauce" to fix stretching:
    // We find how much the browser shrunk the image to fit your screen.
    const naturalWidth = imgRef.current.naturalWidth;
    const currentWidth = imgRef.current.clientWidth;
    setRenderScale(currentWidth / naturalWidth);
  }, []);

  // Recompute scale whenever zoom changes
  useEffect(() => {
    if (!imgRef.current || imageSize.w === 1) return;
    const naturalScale = imgRef.current.clientWidth / imageSize.w / zoom;
    setScale(naturalScale * zoom);
  }, [zoom, imageSize.w]);

  // Scroll-to-zoom on the viewport
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

  // Apply 釋文 to boxes in order
  const applyShiwen = useCallback((chars: string[]) => {
    setShiwenChars(chars);
    setBoxes((prev) => prev.map((b, i) => ({ ...b, char: chars[i] || "" })));
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
    setSelectedId(id);
    setDragging({ id, startX: e.clientX, startY: e.clientY, origX: boxes.find(b => b.id === id)!.x, origY: boxes.find(b => b.id === id)!.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragging.startX) / scale;
    const dy = (e.clientY - dragging.startY) / scale;
    setBoxes((prev) => prev.map((b) => b.id === dragging.id ? { ...b, x: dragging.origX + dx, y: dragging.origY + dy } : b));
  }, [dragging, scale]);

  const handleMouseUp = useCallback(() => { setDragging(null); }, []);

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
    if (!drawMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    // Divide by both zoom (CSS) and renderScale (Image shrinkage)
    setDrawing({ 
      x: (e.clientX - rect.left) / (zoom * renderScale), 
      y: (e.clientY - rect.top) / (zoom * renderScale) 
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
      char: shiwenChars[boxes.length] || "",
    };
    if (newBox.w > 5 && newBox.h > 5) {
      setBoxes((prev) => [...prev, newBox]);
    }
    setDrawing(null);
  };

  const deleteBox = (id: string) => {
    setBoxes((prev) => {
      const next = prev.filter((b) => b.id !== id);
      // Re-assign chars in order
      return next.map((b, i) => ({ ...b, char: shiwenChars[i] || "" }));
    });
    if (selectedId === id) setSelectedId(null);
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

  const countMatch = boxes.length === shiwenChars.length;
  const selectedBox = boxes.find((b) => b.id === selectedId);

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
        <div className="flex items-center gap-2">
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
            <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-1">釋文</p>
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
              <span className="text-[var(--muted)]">框選數</span>
              <span>{boxes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">釋文字數</span>
              <span>{shiwenChars.length}</span>
            </div>
            <div className={`flex justify-between font-bold ${countMatch ? "text-green-400" : "text-yellow-400"}`}>
              <span>狀態</span>
              <span>{countMatch ? "✓ 對齊" : `差 ${Math.abs(boxes.length - shiwenChars.length)} 字`}</span>
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
              {selectedBox && (
                <button onClick={() => deleteBox(selectedBox.id)}
                  className="w-full py-2 rounded-lg border border-red-400 text-red-400 text-xs font-bold hover:bg-red-400 hover:text-[var(--background)] transition-colors">
                  刪除選取框
                </button>
              )}
            </div>
          </div>

          {/* Selected box info */}
          {selectedBox && (
            <div className="bg-[var(--card-bg)] rounded-xl p-3 space-y-1 text-xs">
              <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-2">選取框</p>
              <div className="flex justify-between"><span className="text-[var(--muted)]">字</span><span className="font-display text-lg">{selectedBox.char || "—"}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">來源</span><span>{selectedBox.source}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">信心</span><span>{(selectedBox.confidence * 100).toFixed(0)}%</span></div>
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
              maxWidth: "100%", // This prevents it from being "super huge"
              maxHeight: "80vh" // Optional: keeps it on screen
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
          >
            <img
              ref={imgRef}
              src={`/api/admin/npm-image/${encodeURIComponent(identifier)}?type=clean`}
              style={{ 
                display: "block", 
                maxWidth: "100%", // The image will not exceed the container
                height: "auto"    // This maintains aspect ratio
              }}
              alt={work.name}
              className="block"
              onLoad={handleImageLoad}
              draggable={false}
            />

            {/* Bounding boxes overlay */}
            {boxes.map((box, i) => {
              const isSelected = box.id === selectedId;
              const isLowConf = box.confidence < 0.5;
              return (
                <div
                  key={box.id}
                  onMouseDown={(e) => handleBoxMouseDown(e, box.id)}
                  style={{
                    position: "absolute",
                    left: box.x,
                    top: box.y ,
                    width: box.w,
                    height: box.h ,
                    border: `2px solid ${isSelected ? "#e5b84a" : isLowConf ? "#f97316" : "#22c55e"}`,
                    boxSizing: "border-box",
                    cursor: drawMode ? "crosshair" : "move",
                  }}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(box.id); }}
                >
                  {/* Character label */}
                  <span style={{
                    position: "absolute", top: -18, left: 0,
                    fontSize: 11, lineHeight: 1,
                    color: isSelected ? "#e5b84a" : "#22c55e",
                    background: "rgba(0,0,0,0.6)",
                    padding: "1px 3px", borderRadius: 2,
                    pointerEvents: "none", whiteSpace: "nowrap",
                  }}>
                    {i + 1} {box.char || "?"}
                  </span>
                </div>
              );
            })}

            {/* Click outside to deselect */}
            <div className="absolute inset-0 -z-10" onClick={() => setSelectedId(null)} />
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
