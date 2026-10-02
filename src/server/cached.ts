import { unstable_cache } from "next/cache";
import { getDb } from "@/db/client";
import { bestsellerIds, getFilterOptions, getProductBySlug, listProducts, type CatalogFilters, type ProductCard } from "./catalog";
import { getSettings } from "./settings";

/** Demo sin BD, solo en desarrollo. Imposible en producción por el guard de NODE_ENV. */
export const isDemoMode = () => process.env.DEMO_MODE === "1" && process.env.NODE_ENV !== "production";

// v2: forma nueva con colores por producto; cambiar al cambiar la forma de los datos
// (la Data Cache de Next persiste entre despliegues y serviría entradas con la forma vieja).
// getDb() se llama DENTRO de la función cacheada: el build no abre conexiones.
export const cachedList = async (f: CatalogFilters) => {
  if (isDemoMode()) return (await import("./demo-data")).demoListProducts(f);
  return unstable_cache(() => listProducts(getDb(), f), ["list-v2", JSON.stringify(f)], { tags: ["catalog"], revalidate: 300 })();
};

export const cachedProduct = async (slug: string) => {
  if (isDemoMode()) return (await import("./demo-data")).demoProductBySlug(slug);
  return unstable_cache(() => getProductBySlug(getDb(), slug), ["product-v2", slug], { tags: ["catalog"], revalidate: 300 })();
};

export const cachedFilters = async () => {
  if (isDemoMode()) return (await import("./demo-data")).demoFilterOptions();
  return unstable_cache(() => getFilterOptions(getDb()), ["filters-v3"], { tags: ["catalog"], revalidate: 300 })();
};

/** Ajustes para el layout público (sin caché: cambian desde admin y son una sola fila). */
export const storeSettings = async () => {
  if (isDemoMode()) return (await import("./demo-data")).DEMO_SETTINGS;
  return getSettings(getDb());
};

/** Más vendidos reales. En demo no hay ventas, así que no se inventan: devuelve []. */
export const cachedBestsellers = async (): Promise<ProductCard[]> => {
  if (isDemoMode()) return [];
  return unstable_cache(
    async () => {
      const db = getDb();
      const ids = await bestsellerIds(db, 8);
      if (ids.length === 0) return [];
      const cards = await listProducts(db, { ids });
      return ids.flatMap((id) => cards.find((c) => c.id === id) ?? []);
    },
    ["bestsellers-v1"],
    { tags: ["catalog"], revalidate: 300 },
  )();
};
