"use client";

interface ImageCardProps {
  imageUrl: string;
  calligrapherName: string | null;
  workName: string | null;
  onClick: () => void;
}

export default function ImageCard({
  imageUrl,
  calligrapherName,
  workName,
  onClick,
}: ImageCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group cursor-pointer"
    >
      <div className="w-full aspect-square bg-[var(--card-bg)] rounded-lg overflow-hidden flex items-center justify-center group-hover:bg-[var(--card-hover)] transition-colors">
        <img
          src={imageUrl}
          alt={calligrapherName || "calligraphy"}
          loading="lazy"
          className="w-full h-full object-contain p-1"
        />
      </div>
      <span className="text-xs text-[var(--muted)] truncate w-full text-center">
        {calligrapherName || workName || ""}
      </span>
    </button>
  );
}
