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
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2 text-[var(--foreground)]">
          書法字典
        </h1>
        <p className="text-center text-[var(--muted)] text-sm mb-8">
          Chinese Calligraphy Dictionary
        </p>

        <SearchBar onSearch={handleSearch} placeholder="輸入一個漢字..." />

        <div className="mt-12">
          <p className="text-sm text-[var(--muted)] mb-3 text-center">熱門字</p>
          <div className="flex flex-wrap justify-center gap-2">
            {POPULAR_CHARACTERS.map((char) => (
              <button
                key={char}
                onClick={() => handleSearch(char)}
                className="w-12 h-12 flex items-center justify-center text-2xl bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--card-hover)] transition-colors"
                style={{ fontFamily: "serif" }}
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
