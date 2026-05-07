"use client";

import ImageCard from "./ImageCard";

interface ImageData {
  id: number;
  imagePath: string;
  imageUrl: string;
  character?: string | null;
  calligrapherName: string | null;
  workName: string | null;
  calligrapherId: number | null;
  workId: number | null;
  styleName: string;
  styleSlug: string;
  source?: string | null;
}

interface ImageGridProps {
  images: ImageData[];
  onImageClick: (image: ImageData) => void;
  character?: string;
  favoritedIds?: Set<number>;
  showVariantBadge?: boolean;
}

export default function ImageGrid({ images, onImageClick, character, favoritedIds, showVariantBadge }: ImageGridProps) {
  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--muted)]">
        暫無數據
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
      {images.map((img) => {
        const imgChar = img.character ?? character ?? "";
        return (
          <div key={img.id} className="relative">
            {showVariantBadge && img.character && img.character !== character && (
              <span className="absolute top-1 left-1 z-10 font-display text-xs leading-none bg-[var(--accent)]/90 text-[var(--background)] rounded px-1 py-0.5 pointer-events-none">
                {img.character}
              </span>
            )}
            <ImageCard
              imageUrl={img.imageUrl}
              calligrapherName={img.calligrapherName}
              workName={img.workName}
              onClick={() => onImageClick(img)}
              favoriteImage={imgChar ? {
                id: img.id,
                imagePath: img.imagePath,
                imageUrl: img.imageUrl,
                character: imgChar,
                styleSlug: img.styleSlug,
                calligrapherName: img.calligrapherName,
              } : undefined}
              isFavorited={favoritedIds?.has(img.id) ?? false}
            />
          </div>
        );
      })}
    </div>
  );
}
