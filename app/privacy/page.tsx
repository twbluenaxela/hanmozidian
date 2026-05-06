import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | 翰墨字典",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 pt-12 pb-24">
      <h1 className="font-display text-2xl text-[var(--foreground)] mb-1 tracking-wide">Privacy Policy · 隱私政策</h1>
      <p className="text-xs text-[var(--muted)] tracking-widest mb-10">翰墨字典</p>

      <div className="flex flex-col gap-8 text-sm text-[var(--foreground)] leading-relaxed">

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Overview · 概述</h2>
          <p>
            翰墨字典 (Hanmo Zidian) is a personal, non-commercial Chinese calligraphy reference tool.
            This policy describes what data is collected and how it is used.
          </p>
          <p>
            翰墨字典是一個個人性質、非商業用途的書法參考工具。本政策說明我們蒐集哪些資料，以及如何使用這些資料。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Authentication · 登入方式</h2>
          <p>
            Sign-in is handled by <strong className="font-semibold">Firebase Authentication</strong> (Google).
            When you sign in with Google, we receive your display name and email address from Google.
            These are used solely to identify your account within the app.
          </p>
          <p>
            You may also register with an email address and password directly.
            Passwords are managed by Firebase; we never see or store them in plain text.
          </p>
          <p>
            登入功能由 <strong className="font-semibold">Firebase Authentication</strong>（Google）處理。使用 Google 帳號登入時，我們會取得您的顯示名稱與電子郵件，僅用於識別您的帳號。
          </p>
          <p>
            您也可以直接使用電子郵件與密碼註冊。密碼由 Firebase 管理，我們不會以明文形式儲存或存取您的密碼。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Data We Store · 儲存的資料</h2>
          <p>If you create an account, we store the following in Firebase:</p>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> Your saved favourites (character images you have bookmarked)</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> Your saved 集字 (jizi) compositions</li>
          </ul>
          <p className="text-[var(--muted)] text-xs">
            This data is associated with your user ID and is used only to restore your saves across devices.
          </p>
          <p>若您建立帳號，我們會在 Firebase 中儲存以下資料：</p>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 您收藏的字（已加入書籤的書法圖片）</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 您儲存的集字作品</li>
          </ul>
          <p className="text-[var(--muted)] text-xs">
            這些資料與您的使用者 ID 關聯，僅用於在不同裝置間還原您的儲存內容。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">What We Do Not Collect · 不蒐集的資料</h2>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> No cookies or tracking pixels</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> No advertising or analytics SDKs</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> No data sold or shared with third parties</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> No payment information</li>
          </ul>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 不使用 Cookie 或追蹤像素</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 不使用廣告或分析 SDK</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 不將資料出售或分享給第三方</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 不蒐集任何付款資訊</li>
          </ul>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Third-Party Services · 第三方服務</h2>
          <p>
            This site uses <strong className="font-semibold">Firebase</strong> (Google) for authentication and data storage,
            and <strong className="font-semibold">Cloudflare R2</strong> for serving calligraphy images.
            Both are governed by their own privacy policies.
          </p>
          <p>
            本站使用 <strong className="font-semibold">Firebase</strong>（Google）處理登入與資料儲存，並使用 <strong className="font-semibold">Cloudflare R2</strong> 提供書法圖片。兩者均受其各自的隱私政策規範。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Your Rights · 您的權利</h2>
          <p>
            You can delete your account and associated data at any time by signing in and
            removing your saves, or by ceasing use. For data requests or questions, contact us
            at <a href="mailto:support.hanmozidian@gmail.com" className="text-[var(--accent)] hover:text-[var(--accent-bright)] transition-colors">support.hanmozidian@gmail.com</a>.
          </p>
          <p>
            您可以隨時登入並刪除已儲存的內容，或停止使用本服務。如有資料相關請求或疑問，請聯絡{" "}
            <a href="mailto:support.hanmozidian@gmail.com" className="text-[var(--accent)] hover:text-[var(--accent-bright)] transition-colors">support.hanmozidian@gmail.com</a>。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Changes · 政策變更</h2>
          <p>
            This policy may be updated if the site's functionality changes materially.
            The date below reflects the last revision.
          </p>
          <p>
            若本站功能有重大變更，本政策可能隨之更新。下方日期為最後修訂日期。
          </p>
          <p className="text-[var(--muted)] text-xs mt-1">Last updated · 最後更新：May 2026</p>
        </section>

      </div>
    </div>
  );
}
