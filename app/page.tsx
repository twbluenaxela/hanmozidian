"use client";

import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";

const POPULAR_CHARACTERS = [
  "永", "和", "天", "下", "書", "法", "道", "龍",
  "山", "水", "風", "月", "花", "春", "秋", "雲",
];

export default function HomePage() {
  const router = useRouter();

  const handleSearch = (query: string) => {
    const firstChar = [...query][0];
    if (firstChar) {
      router.push(`/character/${encodeURIComponent(firstChar)}`);
    }
  };

  return (
    <div className="flex flex-col items-center px-4 py-12 min-h-full">
      <div className="w-full max-w-2xl">
        <h1 className="font-display text-inscribed text-5xl sm:text-6xl text-center mb-3">
          書法字典
        </h1>
        <p className="text-center text-[var(--muted)] text-xs tracking-[0.3em] uppercase mb-10">
          Chinese Calligraphy Dictionary
        </p>

        <SearchBar onSearch={handleSearch} placeholder="輸入一個漢字..." />

        <div className="mt-12">
          <p className="font-display text-sm text-[var(--accent-dim)] tracking-widest mb-4 text-center">
            熱 門 字
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {POPULAR_CHARACTERS.map((char) => (
              <button
                key={char}
                onClick={() => handleSearch(char)}
                className="font-display w-12 h-12 flex items-center justify-center text-2xl bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--card-hover)] hover:border-[var(--accent)] hover:text-[var(--accent-bright)] transition-colors"
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
