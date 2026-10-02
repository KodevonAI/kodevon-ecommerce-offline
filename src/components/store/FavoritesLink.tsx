"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useFavorites } from "./FavoritesProvider";

export function FavoritesLink() {
  const { count } = useFavorites();
  return (
    <Link
      href="/favoritos"
      aria-label={count > 0 ? `Favoritos, ${count} ${count === 1 ? "producto" : "productos"}` : "Favoritos"}
      className="t-icon-btn relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <Heart className="size-[18px]" strokeWidth={1.75} aria-hidden />
      {count > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 size-2 rounded-full bg-sale" />}
    </Link>
  );
}
