"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFavorites } from "@/components/store/FavoritesProvider";
import { ProductGrid } from "@/components/store/ProductCard";
import type { ProductCard } from "@/server/catalog";
import { favoriteCards } from "./actions";

export default function FavoritesPage() {
  const { slugs } = useFavorites();
  const key = slugs.join(",");
  const [cards, setCards] = useState<ProductCard[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const list = key ? key.split(",") : [];
    favoriteCards(list)
      .then((c) => { if (live) { setCards(c); setFailed(false); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [key]);

  // Un slug que ya no existe no aparece; mientras cargan, se muestran los que ya había.
  const loading = cards === null && !failed;
  const empty = !loading && !failed && (cards?.length ?? 0) === 0;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-8 pt-10 md:px-8 md:pt-14">
      <h1 className="font-wide text-4xl md:text-5xl">Favoritos</h1>
      {failed && <p role="alert" className="mt-8 text-sm">No pudimos cargar tus favoritos. Revisa tu conexión y recarga la página.</p>}
      {loading && <p className="mt-8 text-mute" aria-live="polite">Cargando favoritos…</p>}
      {empty && (
        <div className="mt-10 flex flex-col items-start gap-4">
          <p className="text-lg">Aún no has guardado nada.</p>
          <p className="max-w-md text-mute">Toca el corazón en cualquier prenda para guardarla aquí y volver a ella cuando quieras.</p>
          <Link href="/tienda" className="press inline-flex h-12 items-center rounded-full px-7 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
            Ir a la tienda
          </Link>
        </div>
      )}
      {cards && cards.length > 0 && (
        <div className="mt-10">
          <ProductGrid products={cards} />
        </div>
      )}
    </div>
  );
}
