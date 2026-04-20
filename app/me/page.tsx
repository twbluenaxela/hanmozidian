"use client";

import { useState } from "react";
import {
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

const AUTH_ERRORS: Record<string, string> = {
  "auth/wrong-password": "密碼錯誤，請再試一次",
  "auth/invalid-credential": "電子郵件或密碼不正確",
  "auth/user-not-found": "找不到此電子郵件帳號",
  "auth/email-already-in-use": "此電子郵件已被使用",
  "auth/weak-password": "密碼至少需要 6 個字元",
  "auth/invalid-email": "電子郵件格式不正確",
  "auth/too-many-requests": "嘗試次數過多，請稍後再試",
};

function authErrorMessage(code: string) {
  return AUTH_ERRORS[code] ?? "登入失敗，請再試一次";
}

export default function MePage() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    const handleSignIn = async () => {
      setError(null);
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (e: unknown) {
        setError(authErrorMessage((e as { code: string }).code));
      }
    };

    const handleRegister = async () => {
      setError(null);
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (e: unknown) {
        setError(authErrorMessage((e as { code: string }).code));
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6">
        <h1 className="font-display text-2xl tracking-widest text-[var(--fg)]">歡迎</h1>
        <p className="text-[var(--muted)] text-sm">登入以儲存收藏</p>

        <button
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="flex items-center gap-3 px-5 py-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--fg)] hover:bg-[var(--hover)] transition-colors text-sm font-medium w-full max-w-xs justify-center"
        >
          <GoogleIcon />
          以 Google 帳號登入
        </button>

        <div className="flex items-center gap-3 w-full max-w-xs">
          <hr className="flex-1 border-[var(--border)]" />
          <span className="text-xs text-[var(--muted)]">或</span>
          <hr className="flex-1 border-[var(--border)]" />
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <input
            type="email"
            placeholder="電子郵件"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--fg)] text-sm outline-none focus:border-[var(--accent)]"
          />
          <input
            type="password"
            placeholder="密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--fg)] text-sm outline-none focus:border-[var(--accent)]"
          />

          {error && (
            <p role="alert" className="text-xs text-red-500">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSignIn}
              className="flex-1 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              登入
            </button>
            <button
              onClick={handleRegister}
              className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-[var(--fg)] text-sm hover:bg-[var(--hover)] transition-colors"
            >
              註冊
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 px-6 pt-12 pb-8">
      <div className="flex flex-col items-center gap-3">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName ?? "使用者"}
            className="w-16 h-16 rounded-full"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-2xl font-display">
            {(user.displayName ?? user.email ?? "?")[0]}
          </div>
        )}
        <div className="text-center">
          {user.displayName && (
            <p className="font-display text-lg tracking-wide text-[var(--fg)]">{user.displayName}</p>
          )}
          <p className="text-sm text-[var(--muted)]">{user.email}</p>
        </div>
      </div>

      <button
        onClick={() => signOut(auth)}
        className="px-4 py-2 text-sm text-[var(--muted)] border border-[var(--border)] rounded-lg hover:text-[var(--fg)] transition-colors"
      >
        登出
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.2 33.6 29.7 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.9 0 20-7.9 20-21 0-1.3-.1-2.7-.5-4z" />
    </svg>
  );
}
