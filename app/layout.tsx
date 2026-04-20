import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "書法字典",
  description:
    "Chinese calligraphy dictionary for calligraphers — browse characters across 篆, 隸, 楷, 行, 草 styles by famous calligraphers and works.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body className="min-h-full flex flex-col pb-16">
        <AuthProvider>
          <main className="flex-1">{children}</main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
