"use client";

import FavoriteButton from "@/components/FavoriteButton";
import type { FavoriteImage } from "@/lib/favorites";

interface ImageCardProps {
  imageUrl: string;
  calligrapherName: string | null;
  workName: string | null;
  onClick: () => void;
  favoriteImage?: FavoriteImage;
  isFavorited?: boolean;
}

export default function ImageCard({
  imageUrl,
  calligrapherName,
  workName,
  onClick,
  favoriteImage,
  isFavorited = false,
}: ImageCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className="flex flex-col items-center gap-1 group cursor-pointer"
    >
      <div className="relative w-full aspect-square bg-[var(--card-bg)] rounded-lg overflow-hidden flex items-center justify-center border border-transparent group-hover:bg-[var(--card-hover)] group-hover:border-[var(--accent-dim)] transition-colors">
        <img
          src={imageUrl}
          alt={calligrapherName || "calligraphy"}
          loading="lazy"
          className="w-full h-full object-contain p-1"
        />
        {favoriteImage && (
          <FavoriteButton image={favoriteImage} isFavorited={isFavorited} />
        )}
      </div>
      <span className="font-display text-xs text-[var(--muted)] group-hover:text-[var(--accent)] truncate w-full text-center transition-colors">
        {calligrapherName || workName || ""}
      </span>
    </div>
  );
}
