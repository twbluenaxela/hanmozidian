import type { Metadata } from "next";
import { Noto_Serif_TC } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/lib/auth-context";

const notoSerifTC = Noto_Serif_TC({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-noto-serif-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "書法字典",
  description:
    "Chinese calligraphy dictionary for calligraphers — browse characters across 篆, 隸, 楷, 行, 草 styles by famous calligraphers and works.",
  other: {
    "color-scheme": "dark",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={`h-full antialiased ${notoSerifTC.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col pb-16" suppressHydrationWarning>
        <AuthProvider>
          <main className="flex-1">{children}</main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
