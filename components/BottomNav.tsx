"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  {
    href: "/",
    label: "字典",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16v16H4z" />
        <path d="M4 9h16" />
      </svg>
    ),
  },
  {
    href: "/beitie",
    label: "碑帖",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="4" y="3" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <line x1="7" y1="8"  x2="15" y2="8"  stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="7" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="7" y1="14" x2="12" y2="14" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/browse",
    label: "瀏覽",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* left roller */}
        <rect x="2" y="5" width="3.5" height="14" rx="1.75" strokeWidth="1.6" />
        {/* right roller */}
        <rect x="18.5" y="5" width="3.5" height="14" rx="1.75" strokeWidth="1.6" />
        {/* scroll body */}
        <rect x="5.5" y="7" width="13" height="10" strokeWidth="1.4" />
        {/* text lines */}
        <line x1="8.5" y1="10.5" x2="15.5" y2="10.5" strokeWidth="1.3" />
        <line x1="8.5" y1="13.5" x2="13"   y2="13.5" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    href: "/jizi",
    label: "集字",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/me",
    label: "我的",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const meLabel = user
    ? (user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "我的")
    : "未登入";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border)]">
      <div className="flex justify-around max-w-2xl mx-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/character")
              : pathname.startsWith(item.href);

          const label = item.href === "/me" ? meLabel : item.label;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-4 transition-colors ${
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--accent-bright)]"
              }`}
            >
              {item.icon}
              <span className="font-display text-xs tracking-wider max-w-[56px] truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
