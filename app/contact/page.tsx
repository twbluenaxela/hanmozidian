import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | 翰墨字典",
};

export default function ContactPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <h1 className="font-display text-2xl text-[var(--foreground)] tracking-wide">Contact · 聯絡我們</h1>
        <p className="text-sm text-[var(--foreground)] leading-relaxed">
          For bug reports, feedback, or data requests, reach us at:
        </p>
        <a
          href="mailto:support.hanmozidian@gmail.com"
          className="text-[var(--accent)] hover:text-[var(--accent-bright)] transition-colors text-sm"
        >
          support.hanmozidian@gmail.com
        </a>
        <p className="text-sm text-[var(--foreground)] leading-relaxed mt-2">
          如有問題回報、意見反饋或資料相關請求，歡迎來信。
        </p>
      </div>
    </div>
  );
}
