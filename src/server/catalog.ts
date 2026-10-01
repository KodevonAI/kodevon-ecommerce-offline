import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { categories, productImages, products, variants } from "@/db/schema";
import { escapeLike } from "@/lib/like";

export type CatalogFilters = {
  category?: string; size?: string; color?: string; min?: number; max?: number;
  sale?: boolean; q?: string; sort?: "new" | "price_asc" | "price_desc";
};
export type ProductCard = {
  id: number; slug: string; name: string; price: number; salePrice: number | null;
  image: string | null; inStock: boolean;
};

const effectivePrice = sql<number>`coalesce(${products.salePrice}, ${products.price})`;
const firstImage = sql<string | null>`(select ${productImages.url} from ${productImages} where ${productImages.productId} = ${products.id} order by ${productImages.position} asc, ${productImages.id} asc limit 1)`;

export async function listProducts(db: Db, f: CatalogFilters): Promise<ProductCard[]> {
  const conds: (SQL | undefined)[] = [eq(products.active, true)];
  if (f.category) conds.push(eq(categories.slug, f.category));
  if (f.size) conds.push(sql`exists (select 1 from ${variants} where ${variants.productId} = ${products.id} and ${variants.size} = ${f.size} and ${variants.stock} > 0)`);
  if (f.color) conds.push(sql`exists (select 1 from ${variants} where ${variants.productId} = ${products.id} and ${variants.colorName} = ${f.color} and ${variants.stock} > 0)`);
  if (typeof f.min === "number" && Number.isFinite(f.min)) conds.push(sql`${effectivePrice} >= ${f.min}`);
  if (typeof f.max === "number" && Number.isFinite(f.max)) conds.push(sql`${effectivePrice} <= ${f.max}`);
  if (f.sale) conds.push(sql`${products.salePrice} is not null`);
  const q = f.q?.trim();
  if (q) conds.push(ilike(products.name, `%${escapeLike(q)}%`));

  const order =
    f.sort === "price_asc" ? [asc(effectivePrice), desc(products.createdAt)]
    : f.sort === "price_desc" ? [desc(effectivePrice), desc(products.createdAt)]
    : [desc(products.createdAt), desc(products.id)];

  const rows = await db
    .select({
      id: products.id, slug: products.slug, name: products.name, price: products.price,
      salePrice: products.salePrice, image: firstImage,
      inStock: sql<boolean>`exists (select 1 from ${variants} where ${variants.productId} = ${products.id} and ${variants.stock} > 0)`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conds))
    .orderBy(...order);
  return rows.map((r) => ({ ...r, image: r.image ?? null, inStock: Boolean(r.inStock) }));
}

export async function getProductBySlug(db: Db, slug: string) {
  const [p] = await db
    .select({
      id: products.id, slug: products.slug, name: products.name, description: products.description,
      price: products.price, salePrice: products.salePrice, categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), eq(products.active, true)))
    .limit(1);
  if (!p) return null;
  const imgs = await db.select({ url: productImages.url }).from(productImages)
    .where(eq(productImages.productId, p.id)).orderBy(asc(productImages.position), asc(productImages.id));
  const vs = await db
    .select({ id: variants.id, size: variants.size, colorName: variants.colorName, colorHex: variants.colorHex, stock: variants.stock })
    .from(variants).where(eq(variants.productId, p.id)).orderBy(asc(variants.size), asc(variants.colorName));
  return { ...p, categoryName: p.categoryName ?? null, images: imgs.map((i) => i.url), variants: vs };
}

export async function getFilterOptions(db: Db) {
  const cats = await db.select({ slug: categories.slug, name: categories.name })
    .from(categories).orderBy(asc(categories.position), asc(categories.name));
  const vs = await db
    .selectDistinct({ size: variants.size, colorName: variants.colorName, colorHex: variants.colorHex })
    .from(variants).innerJoin(products, eq(products.id, variants.productId))
    .where(eq(products.active, true));
  const sizes = [...new Set(vs.map((v) => v.size))].sort();
  const colorMap = new Map<string, string>();
  for (const v of vs) if (!colorMap.has(v.colorName)) colorMap.set(v.colorName, v.colorHex);
  const colors = [...colorMap].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name));
  return { categories: cats, sizes, colors };
}

export async function getCartLines(db: Db, ids: number[]) {
  if (ids.length === 0) return [];
  return db
    .select({
      variantId: variants.id, productName: products.name, slug: products.slug,
      size: variants.size, colorName: variants.colorName, price: effectivePrice,
      stock: variants.stock, image: firstImage, active: products.active,
    })
    .from(variants).innerJoin(products, eq(products.id, variants.productId))
    .where(inArray(variants.id, ids));
}

export type CartLine = Awaited<ReturnType<typeof getCartLines>>[number];

/** Productos inactivos no se publican: solo queda lo mínimo para el aviso "ya no está disponible". */
export function redactInactiveLines(lines: CartLine[]): CartLine[] {
  return lines.map((l) =>
    l.active ? l : { variantId: l.variantId, active: false, productName: l.productName, colorName: l.colorName, size: l.size, slug: "", price: 0, stock: 0, image: null },
  );
}
