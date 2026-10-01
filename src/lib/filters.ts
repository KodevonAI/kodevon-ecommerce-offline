import type { ActiveFilters } from "@/components/store/Filters";

export type Params = Record<string, string | string[] | undefined>;
export type FilterOptionsLike = { categories: { slug: string }[]; sizes: string[]; colors: { name: string }[] };

const SORTS = ["new", "price_asc", "price_desc"] as const;
const MAX_PRICE = 1_000_000_000; // por debajo del límite de int4 de Postgres

const one = (v: string | string[] | undefined) => {
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s.slice(0, 80) : undefined;
};
const num = (v: string | string[] | undefined) => {
  const s = one(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= MAX_PRICE ? Math.floor(n) : undefined;
};

/** Si se pasan `options`, category/size/color desconocidos se ignoran (no dan resultado vacío). */
export function parseFilters(sp: Params, options?: FilterOptionsLike): ActiveFilters {
  const sort = one(sp.sort);
  const category = one(sp.category);
  const size = one(sp.size);
  const color = one(sp.color);
  return {
    category: options && !options.categories.some((c) => c.slug === category) ? undefined : category,
    size: options && !options.sizes.includes(size ?? "") ? undefined : size,
    color: options && !options.colors.some((c) => c.name === color) ? undefined : color,
    min: num(sp.min),
    max: num(sp.max),
    sale: one(sp.sale) === "1" || undefined,
    q: one(sp.q),
    sort: SORTS.find((s) => s === sort),
  };
}
