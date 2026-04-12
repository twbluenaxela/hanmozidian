"use client";

import ImageCard from "./ImageCard";

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

interface ImageGridProps {
  images: ImageData[];
  onImageClick: (image: ImageData) => void;
}

export default function ImageGrid({ images, onImageClick }: ImageGridProps) {
  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--muted)]">
        暫無數據
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
      {images.map((img) => (
        <ImageCard
          key={img.id}
          imageUrl={img.imageUrl}
          calligrapherName={img.calligrapherName}
          workName={img.workName}
          onClick={() => onImageClick(img)}
        />
      ))}
    </div>
  );
}
