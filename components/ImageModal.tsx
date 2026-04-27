"use client";

import { useEffect } from "react";
import { formatAttribution } from "@/lib/source-credits";

interface ImageModalProps {
  imageUrl: string;
  character?: string | null;
  calligrapherName: string | null;
  workName: string | null;
  styleName: string;
  source?: string | null;
  description?: string | null;
  imagePath?: string | null;
  onClose: () => void;
  onZitie?: () => void;
  onNavigate?: () => void;
}

/** Extract the NPM identifier from an image path like images/kai/字_故書00024200002_0.webp */
function extractIdentifier(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  const filename = imagePath.split("/").pop() ?? "";
  // format: <char>_<identifier>_<idx>.webp
  // char is first Unicode grapheme cluster, then underscores separate the rest
  const match = filename.match(/^.+?_(.+)_\d+\.webp$/u);
  return match?.[1] ?? null;
}

export default function ImageModal({
  imageUrl,
  character,
  calligrapherName,
  workName,
  styleName,
  source,
  description,
  imagePath,
  onClose,
  onZitie,
  onNavigate,
}: ImageModalProps) {
  const fallbackAttribution = formatAttribution(source, workName);
  const attribution = description || fallbackAttribution;
  const identifier = extractIdentifier(imagePath);

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

        {/* Image */}
        <div className="flex items-center justify-center p-8 bg-[var(--background)]">
          <img
            src={imageUrl}
            alt={character || calligrapherName || "calligraphy"}
            className="max-w-full max-h-[60vh] object-contain"
          />
        </div>

        {/* Info panel */}
        <div className="p-4 space-y-3">
          {/* Character + navigation */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-baseline gap-3">
              {character && (
                <span className="font-display text-4xl text-[var(--foreground)] leading-none">
                  {character}
                </span>
              )}
              <div className="space-y-0.5">
                {calligrapherName && (
                  <p className="text-[var(--foreground)] text-base leading-tight">{calligrapherName}</p>
                )}
                {workName && (
                  <p className="text-[var(--muted)] text-sm">{workName}</p>
                )}
                <p className="text-[var(--muted)] text-xs">{styleName}</p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {onNavigate && character && (
                <button
                  onClick={onNavigate}
                  className="text-xs border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] px-3 py-1.5 rounded-lg transition-colors"
                >
                  查看「{character}」全部字例
                </button>
              )}
              {onZitie && (
                <button
                  onClick={onZitie}
                  className="border border-[var(--accent)] text-[var(--accent)] px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all"
                >
                  生成字帖
                </button>
              )}
            </div>
          </div>

          {/* Source / copyright */}
          {(attribution || identifier) && (
            <div className="border-t border-[var(--border)] pt-3 space-y-1">
              {identifier && (
                <p className="text-[10px] text-[var(--muted)] font-mono">{identifier}</p>
              )}
              {attribution && (
                <p className="text-[10px] text-[var(--muted)] opacity-70 leading-relaxed">{attribution}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
