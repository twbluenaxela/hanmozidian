"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface WorkSummary {
  identifier: string;
  name: string;
  displayName: string | null;
  calligrapher: string | null;
  era: string | null;
  styleSlug: string | null;
  updatedAt: string | null;
  charCount: number;
}

interface Crop {
  src: string;
  char: string;
}

type Phase = "idle" | "exporting" | "previewing" | "uploading" | "done" | "error";

interface WorkState {
  phase: Phase;
  crops: Crop[];
  exportOutput: string;
  uploadOutput: string;
  error: string;
}

const STYLE_LABELS: Record<string, string> = {
  jinwen: "金", jin: "金", kai: "楷", xing: "行", cao: "草", li: "隸", zhuan: "篆",
};

function defaultState(): WorkState {
  return { phase: "idle", crops: [], exportOutput: "", uploadOutput: "", error: "" };
}

export default function ExportPage() {
  const router = useRouter();

  // Pending queue
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  // Per-work state machine
  const [states, setStates] = useState<Record<string, WorkState>>({});

  // Re-export form
  const [reexportId, setReexportId] = useState("");
  const [reexportItems, setReexportItems] = useState<{ identifier: string }[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/export?page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setWorks(data.works || []);
        setTotal(data.total || 0);
        setTotalChars(data.totalChars || 0);
        setPageSize(data.pageSize || 20);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function setState(id: string, patch: Partial<WorkState>) {
    setStates((prev) => ({ ...prev, [id]: { ...(prev[id] ?? defaultState()), ...patch } }));
  }

  async function runExport(id: string, force = false) {
    setState(id, { phase: "exporting", error: "", exportOutput: "", crops: [] });
    try {
      const res = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState(id, { phase: "error", error: data.error || "Export failed", exportOutput: data.output || "" });
        return;
      }
      // Fetch crops to preview
      const cropsRes = await fetch(`/api/admin/export/crops?id=${encodeURIComponent(id)}`);
      const cropsData = await cropsRes.json();
      setState(id, { phase: "previewing", exportOutput: data.output || "", crops: cropsData.crops || [] });
      // Remove from pending queue if it was there
      load();
    } catch (e: any) {
      setState(id, { phase: "error", error: e.message || "Network error" });
    }
  }

  async function runUpload(id: string) {
    setState(id, { phase: "uploading", error: "" });
    try {
      const res = await fetch("/api/admin/export/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState(id, { phase: "error", error: data.error || "Upload failed", uploadOutput: data.output || "" });
        return;
      }
      setState(id, { phase: "done", uploadOutput: data.output || "" });
    } catch (e: any) {
      setState(id, { phase: "error", error: e.message || "Network error" });
    }
  }

  function addReexportItem() {
    const id = reexportId.trim();
    if (!id) return;
    if (!reexportItems.find((i) => i.identifier === id)) {
      setReexportItems((prev) => [...prev, { identifier: id }]);
    }
    setReexportId("");
  }

  // All identifiers shown on page (pending queue + manual re-export items)
  const pendingIds = works.map((w) => w.identifier);
  const allWorksForDisplay: Array<WorkSummary | { identifier: string; name: string }> = [
    ...works,
    ...reexportItems
      .filter((r) => !pendingIds.includes(r.identifier))
      .map((r) => ({ identifier: r.identifier, name: r.identifier, displayName: null, calligrapher: null, era: null, styleSlug: null, updatedAt: null, charCount: 0 })),
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card-bg)] px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/admin")}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm shrink-0"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-lg">匯出至資料庫</h1>
          <p className="text-xs text-[var(--muted)]">
            {loading ? "載入中…" : `${total} 件待匯出・共 ${totalChars} 個字符`}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">

        {/* Empty state */}
        {!loading && total === 0 && reexportItems.length === 0 && (
          <div className="text-center py-16 text-[var(--muted)]">
            <p className="text-3xl mb-3">✓</p>
            <p className="text-sm">沒有待匯出的作品</p>
          </div>
        )}

        {/* Work cards */}
        {allWorksForDisplay.map((work) => {
          const ws = states[work.identifier] ?? defaultState();
          const isReexport = !pendingIds.includes(work.identifier);
          const fullWork = works.find((w) => w.identifier === work.identifier);

          return (
            <WorkCard
              key={work.identifier}
              work={fullWork ?? work as WorkSummary}
              state={ws}
              isReexport={isReexport}
              onExport={() => runExport(work.identifier, isReexport)}
              onUpload={() => runUpload(work.identifier)}
            />
          );
        })}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] disabled:opacity-30 hover:border-[var(--accent)] transition-colors"
            >
              ←
            </button>
            <span className="text-xs text-[var(--muted)] tabular-nums">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] disabled:opacity-30 hover:border-[var(--accent)] transition-colors"
            >
              →
            </button>
          </div>
        )}

        {/* Re-export section */}
        <div className="border-t border-[var(--border)] pt-6 mt-6">
          <p className="text-[10px] uppercase font-bold text-[var(--accent)] mb-3">重新匯出已完成的作品</p>
          <div className="flex gap-2">
            <input
              value={reexportId}
              onChange={(e) => setReexportId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addReexportItem()}
              placeholder="輸入作品 identifier，例如 故書00024200002"
              className="flex-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
            />
            <button
              onClick={addReexportItem}
              disabled={!reexportId.trim()}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
            >
              加入
            </button>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1.5">
            重新匯出會先刪除舊的裁切圖片及資料庫記錄，再重新裁切
          </p>
        </div>

      </div>
    </div>
  );
}

// ── Work card ─────────────────────────────────────────────────────────────────

interface WorkCardProps {
  work: WorkSummary;
  state: WorkState;
  isReexport: boolean;
  onExport: () => void;
  onUpload: () => void;
}

function WorkCard({ work, state, isReexport, onExport, onUpload }: WorkCardProps) {
  const { phase, crops, exportOutput, uploadOutput, error } = state;
  const busy = phase === "exporting" || phase === "uploading";

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${
      phase === "done"
        ? "border-green-500/40 bg-green-500/5"
        : phase === "error"
        ? "border-red-400/40 bg-red-400/5"
        : "border-[var(--border)] bg-[var(--card-bg)]"
    }`}>

      {/* Top row: thumbnail + info + action */}
      <div className="flex gap-4">
        <div className="shrink-0 w-24 h-24 bg-[var(--background)] overflow-hidden">
          <img
            src={`/api/admin/npm-image/${encodeURIComponent(work.identifier)}?type=clean`}
            alt={work.name}
            className="w-full h-full object-cover object-top"
            loading="lazy"
          />
        </div>

        <div className="flex-1 py-3 pr-4 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-2 flex-wrap">
              <p className="font-display text-sm font-bold truncate">
                {work.displayName || work.name}
              </p>
              {work.styleSlug && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--accent)]/15 text-[var(--accent)]">
                  {STYLE_LABELS[work.styleSlug] ?? work.styleSlug}
                </span>
              )}
              {isReexport && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-400">
                  重新匯出
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {[work.calligrapher, work.era].filter(Boolean).join(" · ")}
            </p>
            <p className="text-[10px] text-[var(--muted)] font-mono mt-0.5">{work.identifier}</p>
          </div>

          <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
            <span className="text-xs text-[var(--muted)]">
              {work.charCount > 0 ? `${work.charCount} 個字符` : ""}
            </span>
            <div className="flex items-center gap-2">
              {phase === "idle" && (
                <button
                  onClick={onExport}
                  className="px-3 py-1 text-xs rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {isReexport ? "重新匯出" : "匯出"}
                </button>
              )}
              {phase === "exporting" && (
                <span className="text-xs text-[var(--muted)] animate-pulse">裁切中…</span>
              )}
              {phase === "previewing" && (
                <>
                  <button
                    onClick={onExport}
                    className="px-3 py-1 text-xs rounded-lg border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] transition-colors"
                    title="重新裁切"
                  >
                    重試
                  </button>
                  <button
                    onClick={onUpload}
                    className="px-3 py-1 text-xs rounded-lg bg-[var(--accent)] text-[var(--background)] font-bold hover:scale-105 transition-all"
                  >
                    上傳至 R2
                  </button>
                </>
              )}
              {phase === "uploading" && (
                <span className="text-xs text-[var(--muted)] animate-pulse">上傳中…</span>
              )}
              {phase === "done" && (
                <span className="text-xs text-green-400 font-bold">✓ 完成</span>
              )}
              {phase === "error" && (
                <button
                  onClick={onExport}
                  className="px-3 py-1 text-xs rounded-lg border border-red-400 text-red-400 hover:bg-red-400 hover:text-[var(--background)] transition-colors"
                >
                  重試
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error output */}
      {phase === "error" && error && (
        <div className="border-t border-red-400/20 px-4 py-3">
          <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* Crop preview strip */}
      {(phase === "previewing" || phase === "uploading" || phase === "done") && crops.length > 0 && (
        <div className="border-t border-[var(--border)]">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] text-[var(--muted)] uppercase font-bold">
              裁切預覽・{crops.length} 個字符
            </span>
            {phase === "done" && uploadOutput && (
              <span className="text-[10px] text-green-400">{uploadOutput.trim().split("\n").pop()}</span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-thin">
            {crops.slice(0, 60).map((crop, i) => (
              <div key={i} className="shrink-0 flex flex-col items-center gap-1">
                <img
                  src={crop.src}
                  alt={crop.char}
                  className="w-14 h-14 object-cover rounded border border-[var(--border)] bg-[var(--background)]"
                  loading="lazy"
                />
                <span className="text-[10px] text-[var(--muted)] font-display leading-none">
                  {crop.char}
                </span>
              </div>
            ))}
            {crops.length > 60 && (
              <div className="shrink-0 flex items-center justify-center w-14 h-14 rounded border border-[var(--border)] text-[10px] text-[var(--muted)]">
                +{crops.length - 60}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export/upload terminal output */}
      {(exportOutput || uploadOutput) && phase !== "idle" && (
        <details className="border-t border-[var(--border)]">
          <summary className="px-4 py-2 text-[10px] text-[var(--muted)] cursor-pointer hover:text-[var(--foreground)] select-none uppercase font-bold">
            終端輸出
          </summary>
          <pre className="px-4 pb-3 text-[10px] font-mono text-[var(--muted)] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {[exportOutput, uploadOutput].filter(Boolean).join("\n---\n").trim()}
          </pre>
        </details>
      )}
    </div>
  );
}
