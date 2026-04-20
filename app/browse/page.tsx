"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ImageModal from "@/components/ImageModal";

interface FilterItem {
  id: number;
  nameZh: string;
  imageCount: number;
  dynasty?: string | null;
}

interface GalleryImage {
  id: number;
  imageUrl: string;
  character: string;
  calligrapherName: string | null;
  calligrapherId: number | null;
  workName: string | null;
  workId: number | null;
  styleName: string;
  styleSlug: string;
}

export default function BrowsePage() {
  const router = useRouter();

  // Filter lists
  const [calligraphers, setCalligraphers] = useState<FilterItem[]>([]);
  const [works, setWorks] = useState<FilterItem[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  // Selections (single-select for clarity)
  const [selectedCalligraphers, setSelectedCalligraphers] = useState<number[]>([]);
  const [selectedWorks, setSelectedWorks] = useState<number[]>([]);

  // Search within sidebar
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"author" | "work">("author");

  // Images + pagination
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [corpusOrdered, setCorpusOrdered] = useState(false);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Modal
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  // IntersectionObserver sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Prevents concurrent fetches from racing (observer fires before state settles)
  const fetchingRef = useRef(false);

  // Fetch sidebar filters once
  useEffect(() => {
    fetch("/api/browse?filters=1")
      .then((r) => r.json())
      .then((data) => {
        setCalligraphers(data.calligraphers || []);
        setWorks(data.works || []);
        setFiltersLoading(false);
      })
      .catch(() => setFiltersLoading(false));
  }, []);

  // Reset + fetch page 1 when selection changes
  useEffect(() => {
    setImages([]);
    setPage(1);
    setHasMore(false);
    setInitialLoad(true);
    setCorpusOrdered(false);
  }, [selectedCalligraphers, selectedWorks]);

  // Fetch a page of images
  const fetchImages = useCallback(
    async (pageNum: number) => {
      if (selectedCalligraphers.length === 0 && selectedWorks.length === 0) {
        setImagesLoading(false);
        setInitialLoad(false);
        return;
      }
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setImagesLoading(true);
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (selectedCalligraphers.length > 0)
        params.set("calligrapher", selectedCalligraphers.join(","));
      if (selectedWorks.length > 0)
        params.set("work", selectedWorks.join(","));
      try {
        const res = await fetch(`/api/browse?${params}`);
        const data = await res.json();
        setImages((prev) => {
          const incoming: GalleryImage[] = data.images ?? [];
          if (pageNum === 1) return incoming;
          // Deduplicate by id in case of race
          const seen = new Set(prev.map((img) => img.id));
          return [...prev, ...incoming.filter((img) => !seen.has(img.id))];
        });
        setHasMore(data.hasMore);
        if (pageNum === 1) setCorpusOrdered(data.corpusOrdered ?? false);
      } finally {
        fetchingRef.current = false;
        setImagesLoading(false);
        setInitialLoad(false);
      }
    },
    [selectedCalligraphers, selectedWorks]
  );

  // Trigger fetch when page or selection changes
  useEffect(() => {
    fetchImages(page);
  }, [page, fetchImages]);

  // Infinite scroll via IntersectionObserver — only wire up when idle
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || imagesLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fetchingRef.current) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, imagesLoading]);

  const toggleCalligrapher = (id: number) => {
    setSelectedWorks([]);
    setSelectedCalligraphers((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [id]
    );
  };

  const toggleWork = (id: number) => {
    setSelectedCalligraphers([]);
    setSelectedWorks((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [id]
    );
  };

  const hasSelection = selectedCalligraphers.length > 0 || selectedWorks.length > 0;

  const filteredCalligraphers = calligraphers.filter((c) =>
    c.nameZh.includes(search)
  );
  const filteredWorks = works.filter((w) => w.nameZh.includes(search));

  const selectionLabel =
    selectedCalligraphers.length > 0
      ? calligraphers.find((c) => c.id === selectedCalligraphers[0])?.nameZh
      : selectedWorks.length > 0
      ? works.find((w) => w.id === selectedWorks[0])?.nameZh
      : null;

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)] flex">
      {/* ── SIDEBAR ── */}
      <aside
        className={`
          shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--background)]
          transition-all duration-300 ease-in-out overflow-hidden
          ${sidebarOpen ? "w-[260px] md:w-[300px]" : "w-0"}
        `}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-4 border-b border-[var(--border)] bg-[var(--card-bg)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm">瀏覽</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-7 h-7 rounded-full bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-xs hover:border-[var(--accent)] transition-colors"
            >
              «
            </button>
          </div>
          <input
            type="text"
            placeholder={`搜索${tab === "author" ? "名家" : "碑帖"}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-[var(--border)]">
          <button
            onClick={() => setTab("author")}
            className={`flex-1 py-2 text-xs font-bold transition-all ${
              tab === "author"
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                : "text-[var(--muted)]"
            }`}
          >
            作者
          </button>
          <button
            onClick={() => setTab("work")}
            className={`flex-1 py-2 text-xs font-bold transition-all ${
              tab === "work"
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                : "text-[var(--muted)]"
            }`}
          >
            作品
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtersLoading ? (
            <div className="text-center py-8 text-xs text-[var(--muted)] animate-pulse">
              載入中...
            </div>
          ) : (
            (tab === "author" ? filteredCalligraphers : filteredWorks).map(
              (item) => {
                const isSelected =
                  tab === "author"
                    ? selectedCalligraphers.includes(item.id)
                    : selectedWorks.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      tab === "author"
                        ? toggleCalligrapher(item.id)
                        : toggleWork(item.id)
                    }
                    className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors ${
                      isSelected
                        ? "bg-[var(--accent)] text-[var(--background)]"
                        : "hover:bg-[var(--card-hover)] text-[var(--foreground)]"
                    }`}
                  >
                    <span className="truncate">{item.nameZh}</span>
                    <span
                      className={`text-[10px] font-bold ml-2 shrink-0 ${
                        isSelected
                          ? "opacity-70"
                          : "text-[var(--accent)]"
                      }`}
                    >
                      {item.imageCount >= 1000
                        ? "1k+"
                        : item.imageCount >= 100
                        ? "100+"
                        : item.imageCount}
                    </span>
                  </button>
                );
              }
            )
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3 flex items-center gap-3">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] flex items-center justify-center text-sm hover:border-[var(--accent)] transition-colors shrink-0"
            >
              »
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="font-display text-sm text-[var(--muted)] hover:text-[var(--accent-bright)] transition-colors shrink-0"
          >
            首頁
          </button>
          <span className="text-[var(--border)]">/</span>
          <span className="font-display text-sm text-[var(--accent)]">
            {selectionLabel ?? "瀏覽字帖"}
          </span>
          {corpusOrdered && (
            <span className="text-[10px] text-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
              按原文排序
            </span>
          )}
          {hasSelection && (
            <button
              onClick={() => {
                setSelectedCalligraphers([]);
                setSelectedWorks([]);
              }}
              className="ml-auto text-[10px] text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
            >
              清除篩選
            </button>
          )}
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasSelection ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <p className="text-4xl font-display text-[var(--accent)]">字帖</p>
              <p className="text-sm text-[var(--muted)] max-w-xs">
                從左側選擇書法家或作品，瀏覽其所有字例
              </p>
            </div>
          ) : initialLoad ? (
            <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm">
              載入中...
            </div>
          ) : images.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm">
              無圖片
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img)}
                    className="group relative aspect-square bg-[var(--card-bg)] rounded-lg overflow-hidden border border-[var(--border)] hover:border-[var(--accent)] transition-all"
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.character}
                      className="w-full h-full object-contain"
                    />
                    {/* Character label on hover */}
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-center font-display text-white text-xs leading-none">
                        {img.character}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-8 mt-4" />

              {imagesLoading && (
                <div className="text-center py-4 text-xs text-[var(--muted)] animate-pulse">
                  載入更多...
                </div>
              )}

              {!hasMore && images.length > 0 && (
                <div className="text-center py-4 text-[10px] text-[var(--muted-dim)]">
                  共 {images.length} 張
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal */}
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
