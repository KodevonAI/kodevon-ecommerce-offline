export const MAX_FAVORITES = 50;

/** Lee los slugs guardados: tolera JSON roto, tipos raros y duplicados. */
export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const slugs = v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 120);
    return [...new Set(slugs)].slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

/** Agrega o quita un slug; lo más reciente va primero y se respeta el máximo. */
export function toggleFavorite(list: string[], slug: string): string[] {
  return list.includes(slug) ? list.filter((s) => s !== slug) : [slug, ...list].slice(0, MAX_FAVORITES);
}
