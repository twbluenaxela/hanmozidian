"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ToastItem = { id: number; type: "success" | "error" | "info"; msg: string };

function Toast({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className="pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm shadow-lg cursor-pointer"
          style={{
            background: t.type === "success" ? "rgba(30,60,40,0.97)" : t.type === "error" ? "rgba(60,20,20,0.97)" : "rgba(30,30,40,0.97)",
            border: `1px solid ${t.type === "success" ? "rgba(100,220,160,0.35)" : t.type === "error" ? "rgba(220,80,80,0.35)" : "rgba(212,168,83,0.3)"}`,
            color: t.type === "success" ? "#64dca0" : t.type === "error" ? "#f87171" : "var(--accent)",
            minWidth: "220px", maxWidth: "340px",
          }}
        >
          <span className="shrink-0 mt-px">{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "✦"}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

const STYLE_OPTIONS = [
  { slug: "jinwen", label: "金文" },
  { slug: "kai",   label: "楷書" },
  { slug: "xing",  label: "行書" },
  { slug: "cao",   label: "草書" },
  { slug: "li",    label: "隸書" },
  { slug: "zhuan", label: "篆書" },
];

function normalizeStyleSlug(styleSlug: string | null | undefined): string {
  if (!styleSlug) return "";
  return styleSlug === "jin" ? "jinwen" : styleSlug;
}

interface NpmResult {
  identifier: string;
  name: string;
  category: string;
  calligrapher: string;
  era: string;
  styleSlug: string;
  sourceUrl: string;
  imageUrl: string;
  imagePages: string[];
  pageCount: number;
  shiwen: string | null;
}

interface FormState {
  title: string;
  author: string;
  dynasty: string;
  style: string;
  styleSlug: string;
  yearLabel: string;
  medium: string;
  charCount: string;
  summary: string;
  tags: string;
  shiwen: string;
  sourceCredit: string;
  sourceUrl: string;
  coverImage: string;
  pages: string[];
  aiHistory: string;
  aiBiography: string;
  aiStyle: string;
  aiInfluence: string;
  aiStories: string;
  aiPractice: string;
}

const EMPTY_FORM: FormState = {
  title: "", author: "", dynasty: "", style: "", styleSlug: "",
  yearLabel: "", medium: "", charCount: "", summary: "", tags: "",
  shiwen: "", sourceCredit: "", sourceUrl: "", coverImage: "", pages: [],
  aiHistory: "", aiBiography: "", aiStyle: "", aiInfluence: "", aiStories: "", aiPractice: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--muted)] mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors";
const textareaCls = `${inputCls} resize-y min-h-[100px]`;
const aiTextareaCls = `${inputCls} resize-y min-h-[160px] text-sm leading-relaxed`;

const AI_FIELDS: { key: keyof FormState; label: string }[] = [
  { key: "aiHistory",   label: "歷史背景" },
  { key: "aiBiography", label: "作者生平" },
  { key: "aiStyle",     label: "書法風格" },
  { key: "aiInfluence", label: "影響傳承" },
  { key: "aiStories",   label: "趣事典故" },
  { key: "aiPractice",  label: "臨摹建議" },
];

const GEMINI_MODELS = [
  { id: "gemini-3.1-pro-preview",         label: "Gemini 3.1 Pro Preview" },
  { id: "gemini-3-pro-preview",           label: "Gemini 3 Pro Preview" },
  { id: "gemini-3-flash-preview",         label: "Gemini 3 Flash Preview（預設）" },
  { id: "gemini-3.1-flash-lite-preview",  label: "Gemini 3.1 Flash-Lite Preview" },
  { id: "gemini-pro-latest",              label: "Gemini Pro Latest" },
  { id: "gemini-flash-latest",            label: "Gemini Flash Latest" },
  { id: "gemini-flash-lite-latest",       label: "Gemini Flash-Lite Latest" },
  { id: "gemini-2.0-flash",               label: "Gemini 2.0 Flash" },
  { id: "gemini-2.5-flash",               label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite",          label: "Gemini 2.5 Flash-Lite" },
  { id: "gemini-2.5-pro",                 label: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash Preview" },
  { id: "gemini-2.5-pro-preview-05-06",   label: "Gemini 2.5 Pro Preview" },
  { id: "gemini-2.0-flash-001",           label: "Gemini 2.0 Flash 001" },
  { id: "gemini-2.0-flash-lite",          label: "Gemini 2.0 Flash-Lite" },
  { id: "gemini-2.0-flash-lite-001",      label: "Gemini 2.0 Flash-Lite 001" },
  { id: "gemini-1.5-flash",               label: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-pro",                 label: "Gemini 1.5 Pro" },
];

export default function BeitieFormPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id as string;
  const isNew = rawId === "new";

  // After creation this holds the persisted numeric ID
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : rawId);
  // True after we just created the record — suppresses the load-from-DB effect
  const justCreatedRef = useRef(false);

  const [form, setForm] = useState<FormState | null>(isNew ? EMPTY_FORM : null);
  const [loading, setLoading] = useState(!isNew);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingD1, setUploadingD1] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCounterRef = useRef(0);
  const showToast = useCallback((type: ToastItem["type"], msg: string, duration = 4000) => {
    const id = ++toastCounterRef.current;
    setToasts((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);
  const [uploadingPages, setUploadingPages] = useState(false);
  const [coverIdx, setCoverIdx] = useState(0);

  // NPM lookup (creation mode)
  const [tab, setTab] = useState<"npm" | "manual">("npm");
  const [npmQuery, setNpmQuery] = useState("");
  const [npmResults, setNpmResults] = useState<NpmResult[]>([]);
  const [npmSearching, setNpmSearching] = useState(false);
  const [selectedNpm, setSelectedNpm] = useState<NpmResult | null>(null);
  const [fetchingPages, setFetchingPages] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI generation
  const [geminiModel, setGeminiModel] = useState("gemini-3-flash-preview");
  const [geminiModels, setGeminiModels] = useState(GEMINI_MODELS);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<{ type: "success" | "rate_limit" | "daily_quota" | "error"; msg: string } | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  // Load existing record in edit mode (skip if we just created it — form state is already correct)
  useEffect(() => {
    if (!savedId) return;
    if (justCreatedRef.current) { justCreatedRef.current = false; return; }
    setLoading(true);
    fetch(`/api/beitie/${savedId}`)
      .then((r) => r.json())
      .then((d) => {
        const it = d.item;
        if (!it) { setLoading(false); return; }
        setCoverIdx(0);
        setForm({
          title: it.title ?? "",
          author: it.author ?? "",
          dynasty: it.dynasty ?? "",
          style: it.style ?? "",
          styleSlug: normalizeStyleSlug(it.styleSlug),
          yearLabel: it.yearLabel ?? "",
          medium: it.medium ?? "",
          charCount: it.charCount != null ? String(it.charCount) : "",
          summary: it.summary ?? "",
          tags: (it.tags ?? []).join(", "),
          shiwen: it.shiwen ?? "",
          sourceCredit: it.sourceCredit ?? "",
          sourceUrl: it.sourceUrl ?? "",
          coverImage: it.coverImage ?? "",
          pages: it.pages ?? [],
          aiHistory: it.aiHistory ?? "",
          aiBiography: it.aiBiography ?? "",
          aiStyle: it.aiStyle ?? "",
          aiInfluence: it.aiInfluence ?? "",
          aiStories: it.aiStories ?? "",
          aiPractice: it.aiPractice ?? "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [savedId]);

  // Fetch live Gemini model list on mount
  useEffect(() => {
    fetch("/api/admin/beitie/generate-ai")
      .then((r) => r.json())
      .then((d) => {
        const models = Array.isArray(d.models) ? d.models : [];
        if (!models.length) return;
        setGeminiModels(models);
        setGeminiModel((prev) => (models.some((m: { id: string }) => m.id === prev) ? prev : models[0].id));
      })
      .catch(() => { /* keep fallback list */ });
  }, []);

  // Retry countdown for rate-limit
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return;
    const t = setTimeout(() => setRetryCountdown((n) => (n !== null ? n - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [retryCountdown]);

  // NPM search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!npmQuery.trim()) { setNpmResults([]); return; }
    debounceRef.current = setTimeout(() => {
      setNpmSearching(true);
      fetch(`/api/admin/beitie/npm-lookup?q=${encodeURIComponent(npmQuery)}`)
        .then((r) => r.json())
        .then((d) => { setNpmResults(d.results ?? []); setNpmSearching(false); })
        .catch(() => setNpmSearching(false));
    }, 300);
  }, [npmQuery]);

  async function selectNpmWork(work: NpmResult) {
    setCoverIdx(0);
    setSelectedNpm(work);
    const slug = normalizeStyleSlug(work.styleSlug);
    const styleLabel = STYLE_OPTIONS.find((s) => s.slug === slug)?.label ?? slug;
    const initialPages = work.imagePages.length > 0 ? work.imagePages : [];
    setForm((p) => ({
      ...(p ?? EMPTY_FORM),
      title: work.name,
      author: work.calligrapher,
      dynasty: work.era,
      style: styleLabel,
      styleSlug: slug,
      shiwen: work.shiwen ?? "",
      sourceCredit: "國立故宮博物院",
      sourceUrl: work.sourceUrl,
      coverImage: initialPages.length > 0 ? initialPages[0] : work.imageUrl,
      pages: initialPages.length > 1 ? initialPages.slice(1) : [],
    }));

    if (work.imagePages.length === 0) {
      setFetchingPages(true);
      try {
        const res = await fetch("/api/admin/beitie/npm-fetch-pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: work.identifier }),
        });
        if (res.ok) {
          const data = await res.json();
          const fetched: string[] = data.pageUrls ?? [];
          if (fetched.length > 0) {
            setForm((p) => p ? { ...p, coverImage: fetched[0], pages: fetched.slice(1) } : p);
            setSelectedNpm((prev) => prev ? { ...prev, imagePages: data.imagePages ?? [], pageCount: fetched.length } : prev);
          }
        }
      } catch {
        // silently fail — user can proceed with single cover image
      } finally {
        setFetchingPages(false);
      }
    }
  }

  function setField(key: keyof FormState, val: string | string[]) {
    setForm((prev) => prev ? { ...prev, [key]: val } : prev);
  }

  async function uploadFiles(files: File[], field: "cover" | "pages") {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (field === "cover") setUploadingCover(true);
    else setUploadingPages(true);
    try {
      const res = await fetch("/api/admin/beitie/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      const urls = (data.uploads as { url: string }[]).map((u) => u.url);
      if (field === "cover") { setField("coverImage", urls[0] ?? ""); setCoverIdx(0); }
      else setForm((p) => p ? { ...p, pages: [...p.pages, ...urls] } : p);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Upload error");
    } finally {
      if (field === "cover") setUploadingCover(false);
      else setUploadingPages(false);
    }
  }

  function removeImage(idx: number) {
    const next = allImages.filter((_, i) => i !== idx);
    setCoverIdx((prev) => {
      if (idx < prev) return prev - 1;
      if (idx === prev) return 0;
      return prev;
    });
    setForm((p) => p ? { ...p, coverImage: next[0] ?? "", pages: next.slice(1) } : p);
  }

  async function handleGenerate() {
    if (!form) return;
    if (!form.title || !form.author || !form.dynasty || !form.style || !form.styleSlug) {
      showToast("error", "請先填寫標題、作者、朝代、書體，才能生成 AI 解析");
      return;
    }
    setGenerating(true);
    setGenStatus(null);
    try {
      const res = await fetch("/api/admin/beitie/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, author: form.author, dynasty: form.dynasty,
          style: form.style, yearLabel: form.yearLabel || null,
          summary: form.summary || null, model: geminiModel,
        }),
      });
      const data = await res.json();
      if (res.status === 429) {
        if (data.error === "daily_quota_exhausted") {
          setRetryCountdown(null);
          setGenStatus({ type: "daily_quota", msg: data.message ?? "今日免費額度已用完，請稍後再試" });
          return;
        }
        setRetryCountdown(data.retrySeconds ?? null);
        setGenStatus({ type: "rate_limit", msg: "" });
        return;
      }
      if (!res.ok) {
        setGenStatus({ type: "error", msg: data.message ?? "生成失敗" });
        return;
      }
      const s = data.sections;
      setForm((p) => p ? {
        ...p,
        aiHistory:   s.history   ?? p.aiHistory,
        aiBiography: s.biography ?? p.aiBiography,
        aiStyle:     s.style     ?? p.aiStyle,
        aiInfluence: s.influence ?? p.aiInfluence,
        aiStories:   s.stories   ?? p.aiStories,
        aiPractice:  s.practice  ?? p.aiPractice,
      } : p);
      setGenStatus({ type: "success", msg: "生成完成，請確認內容後儲存" });
    } catch {
      setGenStatus({ type: "error", msg: "網路錯誤，請重試" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(uploadToD1 = false) {
    if (!form) return;
    if (!form.title || !form.author || !form.dynasty || !form.style || !form.styleSlug) {
      showToast("error", "標題、作者、朝代、書體為必填");
      return;
    }
    setSubmitting(true);

    const hasAi = [form.aiHistory, form.aiBiography, form.aiStyle, form.aiInfluence, form.aiStories, form.aiPractice].some(Boolean);
    const body = {
      title: form.title,
      author: form.author,
      dynasty: form.dynasty,
      style: form.style,
      styleSlug: form.styleSlug,
      yearLabel: form.yearLabel || null,
      medium: form.medium || null,
      charCount: form.charCount ? parseInt(form.charCount) : null,
      summary: form.summary || null,
      tags: form.tags ? form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
      shiwen: form.shiwen || null,
      sourceCredit: form.sourceCredit || null,
      sourceUrl: form.sourceUrl || null,
      coverImage: allImages[coverIdx] || null,
      pages: allImages.filter((_, i) => i !== coverIdx),
      aiHistory: form.aiHistory || null,
      aiBiography: form.aiBiography || null,
      aiStyle: form.aiStyle || null,
      aiInfluence: form.aiInfluence || null,
      aiStories: form.aiStories || null,
      aiPractice: form.aiPractice || null,
      aiGeneratedAt: hasAi ? new Date().toISOString() : null,
    };

    try {
      let id = savedId;
      if (!id) {
        // Create new record
        const res = await fetch("/api/admin/beitie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        id = String(data.id);
        justCreatedRef.current = true;
        setSavedId(id);
        window.history.replaceState(null, "", `/admin/beitie/${id}/edit`);
      } else {
        // Update existing record
        const res = await fetch(`/api/admin/beitie/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      }

      if (uploadToD1) {
        setUploadingD1(true);
        const upRes = await fetch(`/api/admin/beitie/${id}/upload-d1`, { method: "POST" });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error ?? "Upload to D1 failed");
      }

      showToast("success", uploadToD1 ? "儲存並上傳 D1 成功" : savedId ? "變更已儲存" : "碑帖已新增");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Submit error");
    } finally {
      setSubmitting(false);
      setUploadingD1(false);
    }
  }

  if (loading) return <div className="p-6 text-[var(--muted)] animate-pulse">載入中…</div>;
  if (!form) return (
    <div className="p-6 text-[var(--muted)]">
      <p>找不到此碑帖</p>
      <button onClick={() => router.push("/admin/beitie")} className="text-[var(--accent)] text-sm mt-2">← 返回</button>
    </div>
  );

  const allImages = [form.coverImage, ...form.pages].filter(Boolean) as string[];

  return (
    <>
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6 pb-24">
      <button
        onClick={() => router.push("/admin/beitie")}
        className="text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors mb-4 block"
      >
        ← 碑帖管理
      </button>
      <h1 className="font-display text-2xl text-[var(--accent)] mb-6">
        {savedId ? `編輯：${form.title || "（未命名）"}` : "新增碑帖"}
      </h1>

      <div className="max-w-2xl space-y-5">

        {/* NPM lookup — only in creation mode before first save */}
        {!savedId && (
          <>
            <div className="flex border-b border-[var(--border)]">
              {(["npm", "manual"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); if (t === "manual") { setSelectedNpm(null); setNpmResults([]); setNpmQuery(""); } }}
                  className="py-2 px-4 text-sm transition-colors"
                  style={{
                    color: tab === t ? "var(--accent)" : "var(--muted)",
                    borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  {t === "npm" ? "NPM 查詢" : "手動新增"}
                </button>
              ))}
            </div>

            {tab === "npm" && (
              <div className="space-y-4">
                <Field label="搜索 NPM 藏品（名稱、書法家）">
                  <input
                    value={npmQuery}
                    onChange={(e) => setNpmQuery(e.target.value)}
                    placeholder="例：蘭亭、顏真卿、褚遂良…"
                    className={inputCls}
                  />
                </Field>
                {npmSearching && <p className="text-xs text-[var(--muted)] animate-pulse">搜索中…</p>}
                {!npmSearching && npmResults.length > 0 && (
                  <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                    {npmResults.map((w) => (
                      <button
                        key={w.identifier}
                        onClick={() => selectNpmWork(w)}
                        className={`w-full text-left px-4 py-3 border-b border-[var(--border)] last:border-b-0 transition-colors hover:bg-[var(--accent)]/5 ${selectedNpm?.identifier === w.identifier ? "bg-[var(--accent)]/8" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{w.name}</p>
                            <p className="text-xs text-[var(--muted)]">{w.calligrapher || "—"} · {w.era || "—"} · {w.category}</p>
                          </div>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded shrink-0"
                            style={{
                              color: w.pageCount > 1 ? "#64dca0" : "var(--muted)",
                              background: w.pageCount > 1 ? "rgba(100,220,160,0.1)" : "rgba(120,120,120,0.1)",
                            }}
                          >
                            {w.pageCount > 1 ? `${w.pageCount} 頁` : "1 頁"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {fetchingPages && (
                  <div className="text-xs text-[var(--muted)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-2 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
                    正在抓取分頁圖片…
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Image strip — shown when there are images, or always in edit mode */}
        {(allImages.length > 0 || savedId) && (
          <div>
            {allImages.length > 0 && (
              <>
                <p className="text-xs text-[var(--muted)] mb-2">圖片 · {allImages.length} 頁 · 點擊圖片設為封面</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {allImages.map((url, i) => {
                    const isCover = i === coverIdx;
                    return (
                      <div key={i} className="relative shrink-0 group">
                        <img
                          src={url}
                          alt=""
                          onClick={() => { if (!isCover) setCoverIdx(i); }}
                          className={`h-24 w-auto rounded border object-contain bg-[#0a0a0a] transition-colors ${
                            isCover
                              ? "border-[var(--accent)]"
                              : "border-[var(--border)] cursor-pointer group-hover:border-[var(--accent)]/50"
                          }`}
                        />
                        {isCover ? (
                          <span className="absolute top-1 left-1 text-[9px] bg-[var(--accent)] text-black px-1.5 py-0.5 rounded font-medium">封面</span>
                        ) : (
                          <span className="absolute top-1 left-1 text-[9px] bg-black/70 text-[var(--accent)] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            設為封面
                          </span>
                        )}
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 text-[10px] bg-black/60 text-red-400 px-1 rounded hover:bg-red-900/40"
                        >✕</button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Upload controls — always shown in edit mode, or when manual tab / NPM selected */}
        {(savedId || tab === "manual" || selectedNpm) && (
          <div className="flex gap-3 flex-wrap">
            <label className="cursor-pointer">
              <span className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors inline-block">
                {uploadingCover ? "上傳中…" : "上傳封面圖"}
              </span>
              <input type="file" accept="image/*" className="hidden" disabled={uploadingCover}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFiles([f], "cover"); }} />
            </label>
            <label className="cursor-pointer">
              <span className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors inline-block">
                {uploadingPages ? "上傳中…" : savedId ? "新增頁面（可多選）" : "上傳頁面（可多選）"}
              </span>
              <input type="file" accept="image/*" multiple className="hidden" disabled={uploadingPages}
                onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) uploadFiles(fs, "pages"); }} />
            </label>
          </div>
        )}

        {/* Metadata fields — always shown in edit mode, or when manual tab / NPM selected */}
        {(savedId || tab === "manual" || selectedNpm) && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="標題 *"><input value={form.title} onChange={(e) => setField("title", e.target.value)} className={inputCls} /></Field>
              <Field label="作者 *"><input value={form.author} onChange={(e) => setField("author", e.target.value)} className={inputCls} /></Field>
              <Field label="朝代 *"><input value={form.dynasty} onChange={(e) => setField("dynasty", e.target.value)} className={inputCls} placeholder="東晉、唐、宋…" /></Field>
              <Field label="書體 *">
                <select value={form.styleSlug} onChange={(e) => {
                  const slug = e.target.value;
                  const label = STYLE_OPTIONS.find((s) => s.slug === slug)?.label ?? "";
                  setForm((p) => p ? { ...p, styleSlug: slug, style: label } : p);
                }} className={inputCls}>
                  <option value="">選擇書體</option>
                  {STYLE_OPTIONS.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="年代"><input value={form.yearLabel} onChange={(e) => setField("yearLabel", e.target.value)} className={inputCls} placeholder="353年" /></Field>
              <Field label="字數"><input type="number" value={form.charCount} onChange={(e) => setField("charCount", e.target.value)} className={inputCls} /></Field>
            </div>

            <Field label="載體"><input value={form.medium} onChange={(e) => setField("medium", e.target.value)} className={inputCls} placeholder="紙本墨跡、石刻拓片…" /></Field>
            <Field label="簡介"><textarea value={form.summary} onChange={(e) => setField("summary", e.target.value)} className={textareaCls} placeholder="一句話介紹" /></Field>
            <Field label="標籤（逗號分隔）"><input value={form.tags} onChange={(e) => setField("tags", e.target.value)} className={inputCls} placeholder="天下第一行書,永字八法" /></Field>

            <Field label="釋文">
              <textarea value={form.shiwen} onChange={(e) => setField("shiwen", e.target.value)}
                className={`${textareaCls} min-h-[120px] font-display`} placeholder="永和九年歲在癸丑…" />
            </Field>

            <Field label="來源版權"><input value={form.sourceCredit} onChange={(e) => setField("sourceCredit", e.target.value)} className={inputCls} placeholder="國立故宮博物院" /></Field>
            <Field label="來源連結"><input value={form.sourceUrl} onChange={(e) => setField("sourceUrl", e.target.value)} className={inputCls} placeholder="https://…" /></Field>
          </>
        )}

        {/* AI section */}
        {(savedId || tab === "manual" || selectedNpm) && (
          <div className="border-t border-[var(--border)] pt-5 mt-2">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full border self-center" style={{ background: "rgba(212,168,83,0.08)", borderColor: "rgba(212,168,83,0.2)", color: "var(--accent)" }}>
                ✦ AI 解析內容
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={geminiModel}
                  onChange={(e) => { setGeminiModel(e.target.value); setRetryCountdown(null); setGenStatus(null); }}
                  disabled={generating}
                  className="text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
                >
                  {geminiModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <button
                  onClick={handleGenerate}
                  disabled={generating || (retryCountdown !== null && retryCountdown > 0)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: "rgba(212,168,83,0.15)", color: "var(--accent)", border: "1px solid rgba(212,168,83,0.3)" }}
                >
                  {generating ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                      生成中…
                    </>
                  ) : "✦ 生成 AI 解析"}
                </button>
              </div>
            </div>

            {genStatus && (
              <div className={`mb-4 px-3 py-2.5 rounded-lg text-sm flex items-start gap-2 ${
                genStatus.type === "success"     ? "bg-green-900/20 border border-green-700/40 text-green-400" :
                genStatus.type === "rate_limit"  ? "bg-yellow-900/20 border border-yellow-700/40 text-yellow-400" :
                genStatus.type === "daily_quota" ? "bg-orange-900/20 border border-orange-700/40 text-orange-300" :
                                                   "bg-red-900/20 border border-red-700/40 text-red-400"
              }`}>
                <span className="shrink-0 mt-0.5">
                  {genStatus.type === "success" ? "✓" : genStatus.type === "rate_limit" ? "⏳" : genStatus.type === "daily_quota" ? "⚠" : "✕"}
                </span>
                {genStatus.type === "rate_limit" ? (
                  <span>
                    已達 API 請求上限。
                    {retryCountdown !== null && retryCountdown > 0
                      ? <> 請等待 <strong>{retryCountdown}s</strong> 後重試。</>
                      : retryCountdown === 0 ? <> 可以重試了。</> : <> 請稍後再試。</>}
                  </span>
                ) : (
                  <span>{genStatus.msg}</span>
                )}
              </div>
            )}

            <div className="space-y-4">
              {AI_FIELDS.map(({ key, label }) => (
                <Field key={key} label={label}>
                  <textarea
                    value={form[key] as string}
                    onChange={(e) => setField(key, e.target.value)}
                    className={aiTextareaCls}
                    placeholder={`${label}…`}
                  />
                </Field>
              ))}
            </div>
          </div>
        )}

        {(savedId || tab === "manual" || selectedNpm) && (
          <div className="flex gap-3 pt-2 flex-wrap">
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-6 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "儲存中…" : savedId ? "儲存變更" : "新增碑帖"}
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting || uploadingD1}
              className="px-4 py-2 rounded-lg border border-[var(--accent)] text-sm text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-50"
            >
              {submitting || uploadingD1 ? "上傳中…" : "儲存並上傳 D1"}
            </button>
            <button
              onClick={() => router.push("/admin/beitie")}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              {savedId ? "取消" : "返回"}
            </button>
          </div>
        )}
      </div>
    </div>

    <Toast toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </>
  );
}
