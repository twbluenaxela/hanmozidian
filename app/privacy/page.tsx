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
            This policy describes what data is collected, why, how it is used, and your rights regarding it,
            in accordance with Taiwan&apos;s Personal Data Protection Act (個人資料保護法).
          </p>
          <p>
            翰墨字典是一個個人性質、非商業用途的書法參考工具。本政策依據中華民國《個人資料保護法》，說明我們蒐集哪些資料、目的為何、如何使用，以及您的相關權利。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Data Controller · 資料管理者</h2>
          <p>
            The data controller for 翰墨字典 is the individual operator of this service.
            For any data-related requests, please contact:{" "}
            <a href="mailto:support.hanmozidian@gmail.com" className="text-[var(--accent)] hover:text-[var(--accent-bright)] transition-colors">support.hanmozidian@gmail.com</a>.
          </p>
          <p>
            本服務之個人資料管理者為本服務之個人營運者。如有任何資料相關請求，請聯絡：{" "}
            <a href="mailto:support.hanmozidian@gmail.com" className="text-[var(--accent)] hover:text-[var(--accent-bright)] transition-colors">support.hanmozidian@gmail.com</a>。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Authentication · 登入方式</h2>
          <p>
            Sign-in is handled by <strong className="font-semibold">Firebase Authentication</strong> (Google).
            When you sign in with Google, we receive your display name and email address from Google.
            You may also register with an email address and password directly.
            Passwords are managed by Firebase; we never see or store them in plain text.
          </p>
          <p>
            登入功能由 <strong className="font-semibold">Firebase Authentication</strong>（Google）處理。使用 Google 帳號登入時，我們會取得您的顯示名稱與電子郵件。
            您也可以直接使用電子郵件與密碼註冊。密碼由 Firebase 管理，我們不會以明文形式儲存或存取您的密碼。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Data We Collect · 蒐集的資料類別</h2>
          <p>If you create an account, we collect and store the following in Firebase:</p>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> Display name and email address (from Google sign-in or direct registration)</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> Your saved favourites (character images you have bookmarked)</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> Your saved 集字 (jizi) compositions</li>
          </ul>
          <p>若您建立帳號，我們會在 Firebase 中蒐集並儲存以下資料：</p>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 顯示名稱與電子郵件（來自 Google 登入或直接註冊）</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 您收藏的字（已加入書籤的書法圖片）</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 您儲存的集字作品</li>
          </ul>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Purpose of Collection · 蒐集目的</h2>
          <p>
            Personal data is collected solely to provide account functionality — identifying your account and
            restoring your saves across devices. Data is used only within the scope of this stated purpose.
            The legal basis for processing is your consent, given at the time of account registration.
          </p>
          <p>
            個人資料之蒐集目的，僅限於提供帳號功能，包括識別您的帳號及在不同裝置間還原您的儲存內容。資料僅在上述特定目的範圍內使用。處理之法律依據為您於註冊帳號時所給予之同意。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Territory & Recipients · 利用地區與對象</h2>
          <p>
            Your data is stored on <strong className="font-semibold">Firebase</strong> (Google) servers, which may be located outside Taiwan (including in the United States).
            Calligraphy images are served via <strong className="font-semibold">Cloudflare R2</strong>.
            Anonymised usage analytics are collected by <strong className="font-semibold">Umami</strong> (cloud.umami.is) — no cookies are used and no personally identifiable information is transmitted.
            No personal data is shared with, sold to, or disclosed to any other third parties.
          </p>
          <p>
            您的資料儲存於 <strong className="font-semibold">Firebase</strong>（Google）伺服器，該伺服器可能位於台灣以外地區（包括美國）。書法圖片透過 <strong className="font-semibold">Cloudflare R2</strong> 提供。本站使用 <strong className="font-semibold">Umami</strong>（cloud.umami.is）蒐集匿名化使用統計資料，不使用 Cookie，亦不傳輸任何可識別個人身份之資訊。除上述服務外，您的個人資料不會提供、出售或揭露給任何其他第三方。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Retention Period · 保存期間</h2>
          <p>
            Your personal data is retained for as long as your account exists. Upon account deletion or a
            written request to remove your data, your information will be deleted promptly.
          </p>
          <p>
            您的個人資料將保存至您的帳號存續期間。帳號刪除後，或您以書面要求刪除資料時，您的資料將盡速予以刪除。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">What We Do Not Collect · 不蒐集的資料</h2>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> No cookies or tracking pixels</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> No advertising SDKs</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> No payment information</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> No fingerprinting or cross-site tracking</li>
          </ul>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 不使用 Cookie 或追蹤像素</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 不使用廣告 SDK</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 不蒐集任何付款資訊</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 不進行瀏覽器指紋識別或跨站追蹤</li>
          </ul>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Consequences of Non-Provision · 不提供資料之影響</h2>
          <p>
            Providing personal data is voluntary. You may use the calligraphy reference features of this site without creating an account.
            If you choose not to provide your data, you will not be able to save favourites or 集字 compositions across sessions.
          </p>
          <p>
            提供個人資料屬自願性質。您可在不建立帳號的情況下使用本站的書法查詢功能。若您選擇不提供個人資料，將無法跨裝置或跨連線儲存收藏內容或集字作品。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Your Rights · 您的權利</h2>
          <p>
            Under Article 3 of Taiwan&apos;s Personal Data Protection Act, you have the right to:
          </p>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> Inquire about or request to review your personal data</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> Request a copy of your personal data</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> Request correction or supplementation of your personal data</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> Request discontinuation of collection, processing, or use of your personal data</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> Request deletion of your personal data</li>
          </ul>
          <p>
            依據《個人資料保護法》第3條，您對本人之個人資料享有下列權利：
          </p>
          <ul className="flex flex-col gap-1.5 pl-4">
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 查詢或請求閱覽</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 請求製給複製本</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 請求補充或更正</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 請求停止蒐集、處理或利用</li>
            <li className="flex gap-2"><span className="text-[var(--muted)]">—</span> 請求刪除</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:support.hanmozidian@gmail.com" className="text-[var(--accent)] hover:text-[var(--accent-bright)] transition-colors">support.hanmozidian@gmail.com</a>.
          </p>
          <p>
            如需行使上述任何權利，請聯絡{" "}
            <a href="mailto:support.hanmozidian@gmail.com" className="text-[var(--accent)] hover:text-[var(--accent-bright)] transition-colors">support.hanmozidian@gmail.com</a>。
          </p>
        </section>

        <hr className="border-[var(--border)]" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest">Changes · 政策變更</h2>
          <p>
            This policy may be updated if the site&apos;s functionality changes materially.
            The date below reflects the last revision.
          </p>
          <p>
            若本站功能有重大變更，本政策可能隨之更新。下方日期為最後修訂日期。
          </p>
          <p className="text-[var(--muted)] text-xs mt-1">Last updated · 最後更新：20 May 2026</p>
        </section>

      </div>
    </div>
  );
}
