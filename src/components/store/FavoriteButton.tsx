"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "./FavoritesProvider";

export function FavoriteButton({ slug, name, className = "" }: { slug: string; name: string; className?: string }) {
  const { has, toggle } = useFavorites();
  const on = has(slug);
  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={on}
      aria-label={on ? `Quitar ${name} de favoritos` : `Guardar ${name} en favoritos`}
      className={`t-heart t-icon-btn bg-paper/80 backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
    >
      <Heart className="size-[18px]" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
