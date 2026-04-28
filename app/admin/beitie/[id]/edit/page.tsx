"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const STYLE_OPTIONS = [
  { slug: "kai",   label: "楷書" },
  { slug: "xing",  label: "行書" },
  { slug: "cao",   label: "草書" },
  { slug: "li",    label: "隸書" },
  { slug: "zhuan", label: "篆書" },
];

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

export default function EditBeiitiePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPages, setUploadingPages] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/beitie/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const it = d.item;
        if (!it) { setLoading(false); return; }
        setForm({
          title: it.title ?? "",
          author: it.author ?? "",
          dynasty: it.dynasty ?? "",
          style: it.style ?? "",
          styleSlug: it.styleSlug ?? "",
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
  }, [id]);

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
      if (field === "cover") setField("coverImage", urls[0] ?? "");
      else setForm((p) => p ? { ...p, pages: [...p.pages, ...urls] } : p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload error");
    } finally {
      if (field === "cover") setUploadingCover(false);
      else setUploadingPages(false);
    }
  }

  async function handleSubmit() {
    if (!form) return;
    if (!form.title || !form.author || !form.dynasty || !form.style || !form.styleSlug) {
      setError("標題、作者、朝代、書體為必填");
      return;
    }
    setSubmitting(true);
    setError("");

    const aiGeneratedAt = [form.aiHistory, form.aiBiography, form.aiStyle, form.aiInfluence, form.aiStories, form.aiPractice].some(Boolean)
      ? new Date().toISOString()
      : null;

    try {
      const res = await fetch(`/api/admin/beitie/${id}`, {
        method: "PATCH",
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
          aiHistory: form.aiHistory || null,
          aiBiography: form.aiBiography || null,
          aiStyle: form.aiStyle || null,
          aiInfluence: form.aiInfluence || null,
          aiStories: form.aiStories || null,
          aiPractice: form.aiPractice || null,
          aiGeneratedAt,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      router.push("/admin/beitie");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit error");
      setSubmitting(false);
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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6 pb-24">
      <button
        onClick={() => router.push("/admin/beitie")}
        className="text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors mb-4 block"
      >
        ← 碑帖管理
      </button>
      <h1 className="font-display text-2xl text-[var(--accent)] mb-6">編輯：{form.title}</h1>

      <div className="max-w-2xl space-y-5">
        {/* Image preview */}
        {allImages.length > 0 && (
          <div>
            <p className="text-xs text-[var(--muted)] mb-2">圖片 · {allImages.length} 頁</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {allImages.map((url, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={url} alt="" className="h-24 w-auto rounded border border-[var(--border)] object-contain bg-[#0a0a0a]" />
                  {i === 0 && <span className="absolute top-1 left-1 text-[9px] bg-black/60 text-[var(--accent)] px-1 rounded">封面</span>}
                  <button
                    onClick={() => {
                      if (i === 0) setField("coverImage", "");
                      else setForm((p) => p ? { ...p, pages: p.pages.filter((_, pi) => pi !== i - 1) } : p);
                    }}
                    className="absolute top-1 right-1 text-[10px] bg-black/60 text-red-400 px-1 rounded"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload buttons */}
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
              {uploadingPages ? "上傳中…" : "新增頁面（可多選）"}
            </span>
            <input type="file" accept="image/*" multiple className="hidden" disabled={uploadingPages}
              onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) uploadFiles(fs, "pages"); }} />
          </label>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="標題 *"><input value={form.title} onChange={(e) => setField("title", e.target.value)} className={inputCls} /></Field>
          <Field label="作者 *"><input value={form.author} onChange={(e) => setField("author", e.target.value)} className={inputCls} /></Field>
          <Field label="朝代 *"><input value={form.dynasty} onChange={(e) => setField("dynasty", e.target.value)} className={inputCls} /></Field>
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
          <Field label="年代"><input value={form.yearLabel} onChange={(e) => setField("yearLabel", e.target.value)} className={inputCls} /></Field>
          <Field label="字數"><input type="number" value={form.charCount} onChange={(e) => setField("charCount", e.target.value)} className={inputCls} /></Field>
        </div>

        <Field label="載體"><input value={form.medium} onChange={(e) => setField("medium", e.target.value)} className={inputCls} /></Field>
        <Field label="簡介"><textarea value={form.summary} onChange={(e) => setField("summary", e.target.value)} className={textareaCls} /></Field>
        <Field label="標籤（逗號分隔）"><input value={form.tags} onChange={(e) => setField("tags", e.target.value)} className={inputCls} /></Field>

        <Field label="釋文">
          <textarea value={form.shiwen} onChange={(e) => setField("shiwen", e.target.value)} className={`${textareaCls} min-h-[120px] font-display`} placeholder="在此輸入全文釋文…" />
        </Field>

        <Field label="來源版權"><input value={form.sourceCredit} onChange={(e) => setField("sourceCredit", e.target.value)} className={inputCls} /></Field>
        <Field label="來源連結"><input value={form.sourceUrl} onChange={(e) => setField("sourceUrl", e.target.value)} className={inputCls} /></Field>

        {/* AI sections */}
        <div className="border-t border-[var(--border)] pt-5 mt-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs px-2 py-0.5 rounded-full border" style={{ background: "rgba(212,168,83,0.08)", borderColor: "rgba(212,168,83,0.2)", color: "var(--accent)" }}>
              ✦ AI 解析內容
            </span>
            <span className="text-[10px] text-[var(--muted-dim)]">在此貼入 AI 生成的內容</span>
          </div>
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

        {error && <p className="text-sm text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={submitting}
            className="px-6 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {submitting ? "儲存中…" : "儲存變更"}
          </button>
          <button onClick={() => router.push("/admin/beitie")}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
