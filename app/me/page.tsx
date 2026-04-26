"use client";

import { useEffect, useRef, useState } from "react";
import {
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import FavoriteButton from "@/components/FavoriteButton";
import { useAuth } from "@/lib/auth-context";
import { useFavorites } from "@/lib/favorites";
import { useSavedJizi, deleteSavedJizi, MAX_SAVED_JIZI, JIZI_LOAD_KEY, type SavedJizi } from "@/lib/savedJizi";

// ─── constants ───────────────────────────────────────────────────────────────

const MIN_PASSWORD_LENGTH = 12;

const AUTH_ERRORS: Record<string, string> = {
  "auth/wrong-password": "密碼錯誤，請再試一次",
  "auth/invalid-credential": "電子郵件或密碼不正確",
  "auth/user-not-found": "找不到此電子郵件帳號",
  "auth/email-already-in-use": "此電子郵件已被使用",
  "auth/weak-password": `密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元`,
  "auth/invalid-email": "電子郵件格式不正確",
  "auth/too-many-requests": "嘗試次數過多，請稍後再試",
};

function authErrorMessage(code: string) {
  return AUTH_ERRORS[code] ?? "操作失敗，請再試一次";
}

function enlargeGooglePhoto(url: string) {
  return url.replace(/=s\d+-c$/, "=s200-c");
}

// ─── password strength ────────────────────────────────────────────────────────

type Strength = "empty" | "short" | "fair" | "good";

function passwordStrength(pw: string): Strength {
  if (pw.length === 0) return "empty";
  if (pw.length < 8) return "short";
  if (pw.length < MIN_PASSWORD_LENGTH) return "fair";
  return "good";
}

const STRENGTH_LABEL: Record<Strength, string> = {
  empty: "",
  short: "太短",
  fair: "快到了",
  good: "符合要求",
};

const STRENGTH_COLOR: Record<Strength, string> = {
  empty: "bg-[var(--border)]",
  short: "bg-red-500",
  fair: "bg-yellow-500",
  good: "bg-green-500",
};

const STRENGTH_WIDTH: Record<Strength, string> = {
  empty: "w-0",
  short: "w-1/3",
  fair: "w-2/3",
  good: "w-full",
};

// ─── sub-components ───────────────────────────────────────────────────────────

function PasswordInput({
  value,
  onChange,
  placeholder = "密碼",
  showStrength = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  showStrength?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 pr-10 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--muted-dim)]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "隱藏密碼" : "顯示密碼"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-[var(--border)] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${STRENGTH_COLOR[strength]} ${STRENGTH_WIDTH[strength]}`} />
          </div>
          <span className={`text-[10px] w-12 text-right tabular-nums ${
            strength === "good" ? "text-green-500" :
            strength === "fair" ? "text-yellow-500" :
            "text-red-500"
          }`}>
            {STRENGTH_LABEL[strength]}
          </span>
        </div>
      )}

      {showStrength && (
        <p className="text-[10px] text-[var(--muted-dim)] px-0.5">
          至少 {MIN_PASSWORD_LENGTH} 個字元・允許空格與特殊符號
        </p>
      )}
    </div>
  );
}

type Mode = "signin" | "register" | "reset";

function AuthCard() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setResetSent(false);
  };

  const errorCode = (e: unknown): string =>
    typeof e === "object" && e !== null && "code" in e
      ? String((e as { code: unknown }).code)
      : "";

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: unknown) {
      const code = errorCode(e);
      // Silently ignore user-cancelled popups; surface everything else.
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(authErrorMessage(code));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      setError(authErrorMessage(errorCode(e)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元`);
      return;
    }
    setIsSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      setError(authErrorMessage(errorCode(e)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    if (!email) {
      setError("請輸入電子郵件");
      return;
    }
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e: unknown) {
      const code = errorCode(e);
      // Treat "user not found" as success so attackers can't probe which emails are registered.
      if (code !== "auth/user-not-found") {
        setError(authErrorMessage(code));
        setIsSubmitting(false);
        return;
      }
    }
    setResetSent(true);
    setIsSubmitting(false);
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 flex flex-col gap-4">
      {mode !== "reset" && (
        <>
          <button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-lg border border-[var(--border)] text-[var(--foreground)] text-sm font-medium hover:border-[var(--accent-dim)] hover:bg-[var(--card-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GoogleIcon />
            以 Google 帳號登入
          </button>

          <div className="flex items-center gap-3">
            <hr className="flex-1 border-[var(--border)]" />
            <span className="text-[10px] text-[var(--muted)] tracking-widest">或</span>
            <hr className="flex-1 border-[var(--border)]" />
          </div>
        </>
      )}

      <div className="flex flex-col gap-3">
        {mode === "reset" && (
          <p className="text-sm text-[var(--foreground)]">
            {resetSent
              ? `重設連結已寄送至 ${email}`
              : "輸入您的電子郵件，我們將寄送重設密碼的連結"}
          </p>
        )}

        {!resetSent && (
          <>
            <input
              type="email"
              placeholder="電子郵件"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--muted-dim)]"
            />

            {mode !== "reset" && (
              <PasswordInput
                value={password}
                onChange={setPassword}
                showStrength={mode === "register"}
              />
            )}

            {error && (
              <p role="alert" className="text-xs text-red-400 px-0.5">
                {error}
              </p>
            )}

            {mode === "signin" && (
              <button
                onClick={handleSignIn}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-bright)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                登入
              </button>
            )}

            {mode === "register" && (
              <button
                onClick={handleRegister}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-bright)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                註冊
              </button>
            )}

            {mode === "reset" && (
              <button
                onClick={handleReset}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-bright)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                寄送重設連結
              </button>
            )}
          </>
        )}
      </div>

      {/* Mode switcher links */}
      <div className="flex flex-col items-center gap-1.5 pt-1">
        {mode === "signin" && (
          <>
            <button onClick={() => switchMode("register")} className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
              沒有帳號？註冊
            </button>
            <button onClick={() => switchMode("reset")} className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
              忘記密碼？
            </button>
          </>
        )}
        {mode === "register" && (
          <button onClick={() => switchMode("signin")} className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
            已有帳號？登入
          </button>
        )}
        {mode === "reset" && (
          <button onClick={() => switchMode("signin")} className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
            返回登入
          </button>
        )}
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const STYLE_LABELS: Record<string, string> = {
  jinwen: "金文", zhuan: "小篆", li: "隸書", kai: "楷書", xing: "行書", cao: "草書",
};

export default function MePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const favorites = useFavorites(user?.uid ?? null);
  const savedJizi = useSavedJizi(user?.uid ?? null);
  const [activeTab, setActiveTab] = useState<"favorites" | "jizi">("favorites");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          role="status"
          aria-label="載入中"
          className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="text-center mb-2">
            <p className="font-display text-3xl text-inscribed tracking-[0.2em] mb-1">我的</p>
            <p className="text-xs text-[var(--muted)] tracking-widest">登入以儲存收藏</p>
          </div>
          <AuthCard />
        </div>
      </div>
    );
  }

  const photoURL = user.photoURL ? enlargeGooglePhoto(user.photoURL) : null;
  const initials = (user.displayName ?? user.email ?? "?")[0].toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-4 pt-10 pb-24 flex flex-col gap-8">
      <div className="flex items-center gap-5">
        {photoURL ? (
          <img
            src={photoURL}
            alt={user.displayName ?? "使用者"}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-full border-2 border-[var(--border)] shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-full border-2 border-[var(--accent-dim)] bg-[var(--card-bg)] flex items-center justify-center text-3xl font-display text-[var(--accent)] shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          {user.displayName && (
            <p className="font-display text-xl text-[var(--foreground)] truncate">{user.displayName}</p>
          )}
          <p className="text-sm text-[var(--muted)] truncate">{user.email}</p>
          <button
            onClick={() => signOut(auth)}
            className="mt-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
          >
            登出
          </button>
        </div>
      </div>

      <hr className="border-[var(--border)]" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("favorites")}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-px ${activeTab === "favorites" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}
        >
          收藏
        </button>
        <button
          onClick={() => setActiveTab("jizi")}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-px ${activeTab === "jizi" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}
        >
          集字作品
          {savedJizi.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-[var(--card-bg)] border border-[var(--border)] rounded-full px-1.5 py-0.5 text-[var(--muted)]">
              {savedJizi.length}/{MAX_SAVED_JIZI}
            </span>
          )}
        </button>
      </div>

      {activeTab === "favorites" && (
        <div>
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <span className="font-display text-4xl text-[var(--border)]">字</span>
              <p className="text-sm text-[var(--muted)]">尚未收藏任何字</p>
              <p className="text-xs text-[var(--muted-dim)]">在字典頁點擊圖片上的 ♡ 即可收藏</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {favorites.map((fav) => (
                <div key={fav.id} className="flex flex-col items-center gap-1">
                  <div className="relative w-full aspect-square bg-[var(--card-bg)] rounded-lg overflow-hidden border border-[var(--border)] hover:border-[var(--accent-dim)] transition-colors">
                    <img src={fav.imageUrl || `/${fav.imagePath}`} alt={fav.character} className="w-full h-full object-contain p-1" />
                    <FavoriteButton image={fav} isFavorited={true} />
                  </div>
                  <span className="font-display text-xs text-[var(--muted)] truncate w-full text-center">
                    {fav.character}
                    {fav.calligrapherName && <span className="text-[var(--muted-dim)]"> · {fav.calligrapherName}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "jizi" && (
        <div>
          {savedJizi.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <span className="font-display text-4xl text-[var(--border)]">集</span>
              <p className="text-sm text-[var(--muted)]">尚未儲存任何集字作品</p>
              <p className="text-xs text-[var(--muted-dim)]">在集字工坊點擊「儲存」即可存入</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {savedJizi.map((item) => (
                <SavedJiziCard
                  key={item.id}
                  item={item}
                  onLoad={() => {
                    sessionStorage.setItem(JIZI_LOAD_KEY, JSON.stringify({
                      text: item.text,
                      style: item.style,
                      calligraphers: item.calligraphers,
                      works: item.works,
                      orientation: item.orientation,
                      gridSize: item.gridSize,
                      gap: item.gap,
                      paperId: item.paperId,
                      composition: item.composition,
                    }));
                    router.push("/jizi");
                  }}
                  onDelete={() => deleteSavedJizi(user!.uid, item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── saved jizi card ─────────────────────────────────────────────────────────

function SavedJiziCard({
  item,
  onLoad,
  onDelete,
}: {
  item: SavedJizi;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const deleteGroupRef = useRef<HTMLDivElement>(null);

  // Reset confirmation state when the user clicks anywhere outside the
  // delete-button group. We listen on mousedown so a click on the confirm
  // button itself is handled before the outside-click resets state.
  useEffect(() => {
    if (!confirming) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!deleteGroupRef.current?.contains(e.target as Node)) {
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [confirming]);

  const handleDownload = () => {
    if (!item.thumbnail) return;
    const a = document.createElement("a");
    a.href = item.thumbnail;
    a.download = `jizi-${item.text}-${item.id.slice(0, 6)}.png`;
    a.click();
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--accent-dim)] transition-colors">
      {item.thumbnail && (
        <div className="w-full bg-white border-b border-[var(--border)] max-h-56 overflow-hidden flex items-center justify-center">
          <img
            src={item.thumbnail}
            alt={item.text}
            className="w-full object-contain"
          />
        </div>
      )}
      <div className="flex items-center gap-3 p-3">
        {!item.thumbnail && (
          <div className="font-display text-2xl text-[var(--accent)] w-10 shrink-0 text-center leading-none">
            {item.text.slice(0, 2)}
            {item.text.length > 2 && <span className="text-[var(--muted-dim)]">…</span>}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--foreground)] truncate">{item.text}</p>
          <p className="text-[10px] text-[var(--muted)] mt-0.5">
            {STYLE_LABELS[item.style] ?? item.style}
            {" · "}
            {item.orientation === "vertical" ? "直排" : "橫排"}
            {" · "}
            格 {item.gridSize}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.thumbnail && (
            <button
              onClick={handleDownload}
              aria-label="下載作品"
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              下載
            </button>
          )}
          <button
            onClick={onLoad}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--background)] font-bold hover:scale-105 transition-all"
          >
            編輯
          </button>
          <div ref={deleteGroupRef}>
            {confirming ? (
              <button
                onClick={() => { onDelete(); setConfirming(false); }}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold"
              >
                確認刪除
              </button>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:border-red-400 hover:text-red-400 transition-colors"
              >
                刪除
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── icons ────────────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.2 33.6 29.7 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.9 0 20-7.9 20-21 0-1.3-.1-2.7-.5-4z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
