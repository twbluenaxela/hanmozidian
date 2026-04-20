"use client";

import { useEffect } from "react";

interface ImageModalProps {
  imageUrl: string;
  calligrapherName: string | null;
  workName: string | null;
  styleName: string;
  onClose: () => void;
  onZitie?: () => void;
}

export default function ImageModal({
  imageUrl,
  calligrapherName,
  workName,
  styleName,
  onClose,
  onZitie,
}: ImageModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full mx-4 bg-[var(--card-bg)] rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center justify-center p-8 bg-[var(--background)]">
          <img
            src={imageUrl}
            alt={calligrapherName || "calligraphy"}
            className="max-w-full max-h-[60vh] object-contain"
          />
        </div>

        <div className="p-4 flex items-end justify-between gap-4">
          <div className="space-y-1 min-w-0">
            {calligrapherName && (
              <p className="text-[var(--foreground)] text-lg">{calligrapherName}</p>
            )}
            {workName && (
              <p className="text-[var(--muted)] text-sm">{workName}</p>
            )}
            <p className="text-[var(--muted)] text-xs">{styleName}</p>
          </div>
          {onZitie && (
            <button
              onClick={onZitie}
              className="shrink-0 border border-[var(--accent)] text-[var(--accent)] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all"
            >
              生成字帖
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
