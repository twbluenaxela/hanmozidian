"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import StyleTabs from "@/components/StyleTabs";
import SubFilter from "@/components/SubFilter";
import ImageGrid from "@/components/ImageGrid";
import ImageModal from "@/components/ImageModal";

interface StyleCount {
  slug: string;
  nameZh: string;
  count: number;
}

interface ImageData {
  id: number;
  imagePath: string;
  imageUrl: string;
  calligrapherName: string | null;
  workName: string | null;
  calligrapherId: number | null;
  workId: number | null;
  styleName: string;
  styleSlug: string;
}

interface Calligrapher {
  id: number;
  nameZh: string;
  dynasty: string | null;
}

export default function CharacterPage({
  params,
}: {
  params: Promise<{ char: string }>;
}) {
  const { char: rawChar } = use(params);
  const char = decodeURIComponent(rawChar);
  const router = useRouter();

  const [styleCounts, setStyleCounts] = useState<StyleCount[]>([]);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [calligraphers, setCalligraphers] = useState<Calligrapher[]>([]);
  const [selectedCalligrapher, setSelectedCalligrapher] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<"author" | "work">("author");
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch style counts and initial images
  useEffect(() => {
    setLoading(true);
    fetch(`/api/character/${encodeURIComponent(char)}/images`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setStyleCounts([]);
          setImages([]);
          setLoading(false);
          return;
        }
        setStyleCounts(data.styleCounts || []);
        // Set default active style to first available
        const firstStyle = (data.styleCounts || [])[0];
        if (firstStyle) {
          setActiveStyle(firstStyle.slug);
        } else {
          setActiveStyle(null);
          setImages([]);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [char]);

  // Fetch images when style or filter changes
  useEffect(() => {
    if (!activeStyle) return;
    setLoading(true);
    const params = new URLSearchParams({ style: activeStyle });
    if (selectedCalligrapher) {
      params.set("calligrapher", String(selectedCalligrapher));
    }
    fetch(`/api/character/${encodeURIComponent(char)}/images?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setImages(data.images || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [char, activeStyle, selectedCalligrapher]);

  // Fetch calligraphers for filter
  useEffect(() => {
    if (!activeStyle) return;
    const params = new URLSearchParams({ character: char, style: activeStyle });
    fetch(`/api/calligraphers?${params}`)
      .then((r) => r.json())
      .then((data) => setCalligraphers(data.calligraphers || []));
  }, [char, activeStyle]);

  const handleSearch = (query: string) => {
    const firstChar = [...query][0];
    if (firstChar && firstChar !== char) {
      setSelectedCalligrapher(null);
      router.push(`/character/${encodeURIComponent(firstChar)}`);
    }
  };

  return (
    <div className="min-h-full">
      {/* Top search bar */}
      <div className="sticky top-0 z-30 bg-[var(--background)] border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <button
            onClick={() => router.push("/")}
            className="font-display px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--accent-bright)] transition-colors"
          >
            首頁
          </button>
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} initialValue={char} />
          </div>
        </div>
      </div>

      {/* Style tabs */}
      <div className="max-w-2xl mx-auto">
        <StyleTabs
          styles={styleCounts}
          activeStyle={activeStyle}
          onStyleChange={(slug) => {
            setActiveStyle(slug);
            setSelectedCalligrapher(null);
          }}
        />

        {/* Sub-filter bar */}
        <SubFilter
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          calligraphers={calligraphers}
          selectedCalligrapher={selectedCalligrapher}
          onCalligrapherChange={setSelectedCalligrapher}
        />

        {/* Image grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48 text-[var(--muted)]">
            載入中...
          </div>
        ) : (
          <ImageGrid
            images={images}
            onImageClick={(img) => setSelectedImage(img)}
          />
        )}
      </div>

      {/* Lightbox modal */}
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage.imageUrl}
          calligrapherName={selectedImage.calligrapherName}
          workName={selectedImage.workName}
          styleName={selectedImage.styleName}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}
