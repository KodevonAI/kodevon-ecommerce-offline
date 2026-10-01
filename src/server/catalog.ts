import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { categories, productImages, products, variants } from "@/db/schema";
import { escapeLike } from "@/lib/like";

export type CatalogFilters = {
  category?: string; size?: string; color?: string; min?: number; max?: number;
  sale?: boolean; q?: string; sort?: "new" | "price_asc" | "price_desc";
};
export type ColorRef = { slug: string; colorName: string; colorHex: string };
export type ProductCard = {
  id: number; slug: string; name: string; price: number; salePrice: number | null;
  image: string | null; inStock: boolean; colorName: string; colorHex: string; colors: ColorRef[];
};

const effectivePrice = sql<number>`coalesce(${products.salePrice}, ${products.price})`;
const firstImage = sql<string | null>`(select ${productImages.url} from ${productImages} where ${productImages.productId} = ${products.id} order by ${productImages.position} asc, ${productImages.id} asc limit 1)`;

export async function listProducts(db: Db, f: CatalogFilters): Promise<ProductCard[]> {
  const conds: (SQL | undefined)[] = [eq(products.active, true)];
  if (f.category) conds.push(eq(categories.slug, f.category));
  if (f.size) conds.push(sql`exists (select 1 from ${variants} where ${variants.productId} = ${products.id} and ${variants.size} = ${f.size} and ${variants.stock} > 0)`);
  if (f.color) conds.push(eq(products.colorName, f.color));
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
      colorName: products.colorName, colorHex: products.colorHex, modelId: products.modelId,
      inStock: sql<boolean>`exists (select 1 from ${variants} where ${variants.productId} = ${products.id} and ${variants.stock} > 0)`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conds))
    .orderBy(...order);
  const modelIds = [...new Set(rows.map((r) => r.modelId))];
  const sibs = modelIds.length === 0 ? [] : await db
    .select({ id: products.id, slug: products.slug, colorName: products.colorName, colorHex: products.colorHex, modelId: products.modelId })
    .from(products)
    .where(and(inArray(products.modelId, modelIds), eq(products.active, true)))
    .orderBy(asc(products.id));
  return rows.map(({ modelId, ...r }) => ({
    ...r, image: r.image ?? null, inStock: Boolean(r.inStock),
    colors: sibs.filter((s) => s.modelId === modelId && s.id !== r.id)
      .map(({ slug, colorName, colorHex }) => ({ slug, colorName, colorHex })),
  }));
}

export async function getProductBySlug(db: Db, slug: string) {
  const [p] = await db
    .select({
      id: products.id, slug: products.slug, name: products.name, description: products.description,
      price: products.price, salePrice: products.salePrice, categoryName: categories.name,
      colorName: products.colorName, colorHex: products.colorHex, modelId: products.modelId,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), eq(products.active, true)))
    .limit(1);
  if (!p) return null;
  const imgs = await db.select({ url: productImages.url }).from(productImages)
    .where(eq(productImages.productId, p.id)).orderBy(asc(productImages.position), asc(productImages.id));
  const vs = await db
    .select({ id: variants.id, size: variants.size, stock: variants.stock })
    .from(variants).where(eq(variants.productId, p.id)).orderBy(asc(variants.size), asc(variants.id));
  const siblings = await db
    .select({
      slug: products.slug, colorName: products.colorName, colorHex: products.colorHex,
      // "products"."id" explícito: sin join, drizzle emitiría "id" a secas y se resolvería a variants.id
      inStock: sql<boolean>`exists (select 1 from ${variants} where ${variants.productId} = "products"."id" and ${variants.stock} > 0)`,
    })
    .from(products)
    .where(and(eq(products.modelId, p.modelId), eq(products.active, true)))
    .orderBy(asc(products.id));
  const { modelId: _modelId, ...rest } = p;
  void _modelId;
  return {
    ...rest, categoryName: p.categoryName ?? null, images: imgs.map((i) => i.url), variants: vs,
    siblings: siblings.map((x) => ({ ...x, inStock: Boolean(x.inStock) })),
  };
}

export async function getFilterOptions(db: Db) {
  const cats = await db.select({ slug: categories.slug, name: categories.name })
    .from(categories).orderBy(asc(categories.position), asc(categories.name));
  const sizeRows = await db
    .selectDistinct({ size: variants.size })
    .from(variants).innerJoin(products, eq(products.id, variants.productId))
    .where(eq(products.active, true));
  const sizes = [...new Set(sizeRows.map((v) => v.size))].sort();
  const colors = await db
    .selectDistinct({ name: products.colorName, hex: products.colorHex })
    .from(products)
    .where(and(eq(products.active, true), sql`${products.colorName} <> ''`))
    .orderBy(asc(products.colorName));
  return { categories: cats, sizes, colors };
}

export async function getCartLines(db: Db, ids: number[]) {
  if (ids.length === 0) return [];
  return db
    .select({
      variantId: variants.id, productName: products.name, slug: products.slug,
      size: variants.size, colorName: products.colorName, price: effectivePrice,
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
