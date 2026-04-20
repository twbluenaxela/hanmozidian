"use client";

import { useAuth } from "@/lib/auth-context";
import { addFavorite, removeFavorite, FavoriteImage } from "@/lib/favorites";

interface Props {
  image: FavoriteImage;
  isFavorited: boolean;
}

export default function FavoriteButton({ image, isFavorited }: Props) {
  const { user } = useAuth();
  if (!user) return null;

  const toggle = () => {
    if (isFavorited) {
      removeFavorite(user.uid, image.id);
    } else {
      addFavorite(user.uid, image);
    }
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      aria-label={isFavorited ? "取消收藏" : "加入收藏"}
      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={isFavorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        className={isFavorited ? "text-red-400" : "text-white"}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
