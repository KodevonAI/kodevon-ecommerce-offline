import { unstable_cache } from "next/cache";
import { getDb } from "@/db/client";
import { getFilterOptions, getProductBySlug, listProducts, type CatalogFilters } from "./catalog";
import { getSettings } from "./settings";

/** Demo sin BD, solo en desarrollo. Imposible en producción por el guard de NODE_ENV. */
export const isDemoMode = () => process.env.DEMO_MODE === "1" && process.env.NODE_ENV !== "production";

// getDb() se llama DENTRO de la función cacheada: el build no abre conexiones.
export const cachedList = async (f: CatalogFilters) => {
  if (isDemoMode()) return (await import("./demo-data")).demoListProducts(f);
  return unstable_cache(() => listProducts(getDb(), f), ["list", JSON.stringify(f)], { tags: ["catalog"], revalidate: 300 })();
};

export const cachedProduct = async (slug: string) => {
  if (isDemoMode()) return (await import("./demo-data")).demoProductBySlug(slug);
  return unstable_cache(() => getProductBySlug(getDb(), slug), ["product", slug], { tags: ["catalog"], revalidate: 300 })();
};

export const cachedFilters = async () => {
  if (isDemoMode()) return (await import("./demo-data")).demoFilterOptions();
  return unstable_cache(() => getFilterOptions(getDb()), ["filters"], { tags: ["catalog"], revalidate: 300 })();
};

/** Ajustes para el layout público (sin caché: cambian desde admin y son una sola fila). */
export const storeSettings = async () => {
  if (isDemoMode()) return (await import("./demo-data")).DEMO_SETTINGS;
  return getSettings(getDb());
};
