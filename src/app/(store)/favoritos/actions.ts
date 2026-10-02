"use server";

import { MAX_FAVORITES } from "@/lib/favorites";
import type { ProductCard } from "@/server/catalog";
import { cachedList } from "@/server/cached";

/** Resuelve los slugs guardados en el navegador a tarjetas de producto (solo activos), en el mismo orden. */
export async function favoriteCards(slugs: string[]): Promise<ProductCard[]> {
  const clean = [...new Set((Array.isArray(slugs) ? slugs : []).filter((s): s is string => typeof s === "string" && s.length > 0 && s.length <= 120))].slice(0, MAX_FAVORITES);
  if (clean.length === 0) return [];
  const cards = await cachedList({ slugs: clean });
  return clean.flatMap((s) => cards.find((c) => c.slug === s) ?? []);
}
