"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STYLE_OPTIONS = [
  { slug: "kai",   label: "楷書" },
  { slug: "xing",  label: "行書" },
  { slug: "cao",   label: "草書" },
  { slug: "li",    label: "隸書" },
  { slug: "zhuan", label: "篆書" },
];

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
}

const EMPTY_FORM: FormState = {
  title: "", author: "", dynasty: "", style: "", styleSlug: "",
  yearLabel: "", medium: "", charCount: "", summary: "", tags: "",
  shiwen: "", sourceCredit: "", sourceUrl: "", coverImage: "", pages: [],
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
const textareaCls = `${inputCls} resize-y min-h-[80px]`;

export default function AddBeiitiePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"npm" | "manual">("npm");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // NPM lookup state
  const [npmQuery, setNpmQuery] = useState("");
  const [npmResults, setNpmResults] = useState<NpmResult[]>([]);
  const [npmSearching, setNpmSearching] = useState(false);
  const [selectedNpm, setSelectedNpm] = useState<NpmResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Upload state
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPages, setUploadingPages] = useState(false);

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

  function selectNpmWork(work: NpmResult) {
    setSelectedNpm(work);
    const styleLabel = STYLE_OPTIONS.find((s) => s.slug === work.styleSlug)?.label ?? work.styleSlug;
    setForm({
      title: work.name,
      author: work.calligrapher,
      dynasty: work.era,
      style: styleLabel,
      styleSlug: work.styleSlug,
      yearLabel: "",
      medium: "",
      charCount: "",
      summary: "",
      tags: "",
      shiwen: work.shiwen ?? "",
      sourceCredit: "國立故宮博物院",
      sourceUrl: work.sourceUrl,
      coverImage: work.imagePages.length > 0 ? work.imagePages[0] : work.imageUrl,
      pages: work.imagePages.length > 1 ? work.imagePages.slice(1) : [],
    });
  }

  function setField(key: keyof FormState, val: string | string[]) {
    setForm((prev) => ({ ...prev, [key]: val }));
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
      if (field === "cover") {
        setField("coverImage", urls[0] ?? "");
      } else {
        setForm((prev) => ({ ...prev, pages: [...prev.pages, ...urls] }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload error");
    } finally {
      if (field === "cover") setUploadingCover(false);
      else setUploadingPages(false);
    }
  }

  async function handleSubmit() {
    if (!form.title || !form.author || !form.dynasty || !form.style || !form.styleSlug) {
      setError("標題、作者、朝代、書體為必填");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/beitie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          coverImage: form.coverImage || null,
          pages: form.pages,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      router.push("/admin/beitie");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit error");
      setSubmitting(false);
    }
  }

  const allImages = [form.coverImage, ...form.pages].filter(Boolean) as string[];
  const isMultiPageNpm = selectedNpm && selectedNpm.pageCount === 1 &&
    ["法帖", "拓片"].includes(selectedNpm.category);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6 pb-24">
      {/* Header */}
      <button
        onClick={() => router.push("/admin/beitie")}
        className="text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors mb-4 block"
      >
        ← 碑帖管理
      </button>
      <h1 className="font-display text-2xl text-[var(--accent)] mb-6">新增碑帖</h1>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] mb-6">
        {(["npm", "manual"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setForm(EMPTY_FORM); setSelectedNpm(null); setNpmResults([]); setNpmQuery(""); }}
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

      <div className="max-w-2xl space-y-5">
        {/* ── NPM Lookup tab ── */}
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

            {/* Results list */}
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
                          color: w.pageCount > 1 ? "#64dca0" : w.pageCount === 1 && ["法帖","拓片"].includes(w.category) ? "#f59e0b" : "var(--muted)",
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

            {selectedNpm && isMultiPageNpm && (
              <div className="text-xs text-amber-400/80 bg-amber-400/8 border border-amber-400/20 rounded-lg px-3 py-2">
                ⚠ 此件可能有多頁，但尚未抓取。請先執行 <code className="font-mono">python pipeline/fetch_pages.py --id {selectedNpm.identifier}</code>，再重新查詢。
              </div>
            )}
          </div>
        )}

        {/* ── Image preview strip (shared) ── */}
        {allImages.length > 0 && (
          <div>
            <p className="text-xs text-[var(--muted)] mb-2">圖片預覽 · {allImages.length} 頁</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {allImages.map((url, i) => (
                <div key={i} className="relative shrink-0">
                  <img
                    src={url}
                    alt=""
                    className="h-24 w-auto rounded border border-[var(--border)] object-contain bg-[#0a0a0a]"
                  />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 text-[9px] bg-black/60 text-[var(--accent)] px-1 rounded">封面</span>
                  )}
                  <button
                    onClick={() => {
                      if (i === 0) setField("coverImage", "");
                      else setForm((p) => ({ ...p, pages: p.pages.filter((_, pi) => pi !== i - 1) }));
                    }}
                    className="absolute top-1 right-1 text-[10px] bg-black/60 text-red-400 px-1 rounded hover:bg-red-900/40"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Manual upload controls (only in manual tab, or after NPM selection to add more) ── */}
        {(tab === "manual" || selectedNpm) && (
          <div className="flex gap-3 flex-wrap">
            <label className="cursor-pointer">
              <span className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors inline-block">
                {uploadingCover ? "上傳中…" : "上傳封面圖"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingCover}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFiles([f], "cover"); }}
              />
            </label>
            <label className="cursor-pointer">
              <span className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors inline-block">
                {uploadingPages ? "上傳中…" : "上傳頁面（可多選）"}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploadingPages}
                onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) uploadFiles(fs, "pages"); }}
              />
            </label>
          </div>
        )}

        {/* ── Metadata fields (always shown after NPM selection or in manual tab) ── */}
        {(tab === "manual" || selectedNpm) && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="標題 *">
                <input value={form.title} onChange={(e) => setField("title", e.target.value)} className={inputCls} />
              </Field>
              <Field label="作者 *">
                <input value={form.author} onChange={(e) => setField("author", e.target.value)} className={inputCls} />
              </Field>
              <Field label="朝代 *">
                <input value={form.dynasty} onChange={(e) => setField("dynasty", e.target.value)} className={inputCls} placeholder="東晉、唐、宋…" />
              </Field>
              <Field label="書體 *">
                <select
                  value={form.styleSlug}
                  onChange={(e) => {
                    const slug = e.target.value;
                    const label = STYLE_OPTIONS.find((s) => s.slug === slug)?.label ?? "";
                    setForm((p) => ({ ...p, styleSlug: slug, style: label }));
                  }}
                  className={inputCls}
                >
                  <option value="">選擇書體</option>
                  {STYLE_OPTIONS.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="年代">
                <input value={form.yearLabel} onChange={(e) => setField("yearLabel", e.target.value)} className={inputCls} placeholder="353年" />
              </Field>
              <Field label="字數">
                <input type="number" value={form.charCount} onChange={(e) => setField("charCount", e.target.value)} className={inputCls} />
              </Field>
            </div>

            <Field label="載體">
              <input value={form.medium} onChange={(e) => setField("medium", e.target.value)} className={inputCls} placeholder="紙本墨跡、石刻拓片…" />
            </Field>

            <Field label="簡介">
              <textarea value={form.summary} onChange={(e) => setField("summary", e.target.value)} className={textareaCls} placeholder="一句話介紹" />
            </Field>

            <Field label="標籤（逗號分隔）">
              <input value={form.tags} onChange={(e) => setField("tags", e.target.value)} className={inputCls} placeholder="天下第一行書,永字八法" />
            </Field>

            <Field label="釋文">
              <textarea
                value={form.shiwen}
                onChange={(e) => setField("shiwen", e.target.value)}
                className={`${textareaCls} min-h-[120px] font-display`}
                placeholder="永和九年歲在癸丑…"
              />
            </Field>

            <Field label="來源版權">
              <input value={form.sourceCredit} onChange={(e) => setField("sourceCredit", e.target.value)} className={inputCls} placeholder="國立故宮博物院" />
            </Field>

            <Field label="來源連結">
              <input value={form.sourceUrl} onChange={(e) => setField("sourceUrl", e.target.value)} className={inputCls} placeholder="https://digitalarchive.npm.gov.tw/…" />
            </Field>
          </>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Submit */}
        {(tab === "manual" || selectedNpm) && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "儲存中…" : "新增碑帖"}
            </button>
            <button
              onClick={() => router.push("/admin/beitie")}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
