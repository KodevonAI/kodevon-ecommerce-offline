import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { cachedList } from "@/server/cached";

// Lee el catálogo: se genera por petición para que el build no toque la BD.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const products = await cachedList({ sort: "new" });
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/tienda`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/privacidad`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${base}/terminos`, changeFrequency: "yearly", priority: 0.1 },
    ...products.map((p) => ({ url: `${base}/producto/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
