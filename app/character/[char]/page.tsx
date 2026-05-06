"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import StyleTabs from "@/components/StyleTabs";
import ImageGrid from "@/components/ImageGrid";
import ImageModal from "@/components/ImageModal";
import JiziPicker from "@/components/JiziPicker";
import ZitieModal from "@/components/ZitieModal";
import { useAuth } from "@/lib/auth-context";
import { useFavorites } from "@/lib/favorites";

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
  source?: string | null;
}

export default function CharacterPage({
  params,
}: {
  params: Promise<{ char: string }>;
}) {
  const { char: rawChar } = use(params);
  const char = decodeURIComponent(rawChar);
  const router = useRouter();

  const { user } = useAuth();
  const favorites = useFavorites(user?.uid ?? null);
  const favoritedIds = new Set(favorites.map((f) => f.id));

  const [styleCounts, setStyleCounts] = useState<StyleCount[]>([]);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedCalligraphers, setSelectedCalligraphers] = useState<number[]>([]);
  const [selectedWorks, setSelectedWorks] = useState<number[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zitieOpen, setZitieOpen] = useState(false);

  // Fetch style counts on character change
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
        // Redirect to canonical traditional-character URL if a simplified char was used
        if (data.character && data.character !== char) {
          router.replace(`/character/${encodeURIComponent(data.character)}`);
          return;
        }
        setStyleCounts(data.styleCounts || []);
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

  // Fetch images when style or filters change
  useEffect(() => {
    if (!activeStyle) return;
    setLoading(true);
    const params = new URLSearchParams({ style: activeStyle });
    if (selectedCalligraphers.length > 0) {
      params.set("calligrapher", selectedCalligraphers.join(","));
    }
    if (selectedWorks.length > 0) {
      params.set("work", selectedWorks.join(","));
    }
    fetch(`/api/character/${encodeURIComponent(char)}/images?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setImages(data.images || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [char, activeStyle, selectedCalligraphers, selectedWorks]);

  const handleSearch = (query: string) => {
    const firstChar = [...query][0];
    if (firstChar && firstChar !== char) {
      setSelectedCalligraphers([]);
      setSelectedWorks([]);
      router.push(`/character/${encodeURIComponent(firstChar)}`);
    }
  };

  const handleStyleChange = (slug: string) => {
    setActiveStyle(slug);
    setSelectedCalligraphers([]);
    setSelectedWorks([]);
  };

  const hasFilters = selectedCalligraphers.length > 0 || selectedWorks.length > 0;

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* MAIN AREA — always full width; sidebar floats over it */}
      <div className="flex flex-col h-full">
        {/* Top search bar */}
        <div className="shrink-0 z-30 bg-[var(--background)] border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <button
              onClick={() => router.push("/")}
              className="font-display px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--accent-bright)] transition-colors shrink-0"
            >
              首頁
            </button>
            <div className="flex-1 min-w-0">
              <SearchBar onSearch={handleSearch} initialValue={char} />
            </div>
          </div>
        </div>

        {/* Style tabs */}
        <div className="shrink-0">
          <div className="max-w-2xl mx-auto">
            <StyleTabs
              styles={styleCounts}
              activeStyle={activeStyle}
              onStyleChange={handleStyleChange}
            />
          </div>
        </div>

        {/* Scrollable image area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto pb-20">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-[var(--muted)]">
                載入中...
              </div>
            ) : (
              <ImageGrid
                images={images}
                onImageClick={(img) => setSelectedImage(img)}
                character={char}
                favoritedIds={favoritedIds}
              />
            )}
          </div>
        </div>
      </div>

      {/* BACKDROP — tap outside to close on mobile */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setPickerOpen(false)}
        />
      )}

      {/* SIDEBAR TOGGLE HANDLE */}
      {!pickerOpen && (
        <button
          onClick={() => setPickerOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-[var(--card-bg)] border border-[var(--border)] border-r-0 p-2 pl-3 rounded-l-xl z-40 hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all group"
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl">«</span>
            <span className="text-[10px] [writing-mode:vertical-lr] font-bold tracking-widest">
              篩選
            </span>
            {hasFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] group-hover:bg-[var(--background)]" />
            )}
          </div>
        </button>
      )}

      {/* SIDEBAR — always fixed overlay, never pushes content */}
      <aside
        className={`
          fixed right-0 inset-y-0 z-50
          bg-[var(--background)] border-l border-[var(--border)]
          flex flex-col
          transition-transform duration-300 ease-in-out
          w-[85vw] sm:w-80 md:w-[340px]
          ${pickerOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Sidebar header */}
        <div className="shrink-0 px-5 py-4 border-b border-[var(--border)] bg-[var(--card-bg)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">篩選</h2>
            <p className="text-[10px] text-[var(--muted)] mt-0.5 font-display">
              {char} · {styleCounts.find((s) => s.slug === activeStyle)?.nameZh ?? ""}
              {hasFilters && (
                <span className="ml-2 text-[var(--accent)]">
                  {selectedCalligraphers.length + selectedWorks.length} 已選
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setPickerOpen(false)}
            className="w-8 h-8 rounded-full bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-base hover:border-[var(--accent)] transition-colors"
          >
            »
          </button>
        </div>

        {/* Picker content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          {activeStyle ? (
            <JiziPicker
              text={char}
              style={activeStyle}
              open={pickerOpen}
              selectedCalligraphers={selectedCalligraphers}
              selectedWorks={selectedWorks}
              onToggleCalligrapher={(id) =>
                setSelectedCalligraphers((p) =>
                  p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
                )
              }
              onToggleWork={(id) =>
                setSelectedWorks((p) =>
                  p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
                )
              }
              onReset={() => {
                setSelectedCalligraphers([]);
                setSelectedWorks([]);
              }}
            />
          ) : (
            <p className="text-sm text-[var(--muted)] text-center py-10">
              請先選擇書體
            </p>
          )}
        </div>
      </aside>

      {/* 字帖 modal */}
      {zitieOpen && (
        <ZitieModal
          char={char}
          images={images}
          initialImageId={selectedImage?.id}
          onClose={() => setZitieOpen(false)}
        />
      )}

      {/* Lightbox modal */}
      {selectedImage && !zitieOpen && (
        <ImageModal
          imageUrl={selectedImage.imageUrl}
          calligrapherName={selectedImage.calligrapherName}
          workName={selectedImage.workName}
          styleName={selectedImage.styleName}
          source={selectedImage.source}
          onClose={() => setSelectedImage(null)}
          onZitie={() => setZitieOpen(true)}
        />
      )}
    </div>
  );
}
