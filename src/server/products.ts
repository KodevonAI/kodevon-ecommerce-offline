import { and, asc, count, eq, like, ne } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, productImages, products, stockMovements, variants } from "@/db/schema";
import { slugify } from "@/lib/slug";
import type { ProductFullInput } from "@/lib/validators";

export type ProductInput = Omit<ProductFullInput, "variants"> & { variants: { size: string; stock: number }[] };
type Q = Db; // dentro de una transacción se pasa `tx as unknown as Db` (misma API de consultas)

const collapse = (s: string) => s.trim().replace(/\s+/g, " ");

/** Tallas: espacios colapsados, en mayúsculas y sin repetidos. */
export function normalizeSizes(sizes: string[]): string[] {
  return [...new Set(sizes.map((s) => collapse(s).toUpperCase()).filter(Boolean))];
}

async function uniqueSlug(q: Q, base: string): Promise<string> {
  const existing = await q.select({ slug: products.slug }).from(products).where(like(products.slug, `${base}%`));
  const taken = new Set(existing.map((r) => r.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

function cleanVariants(input: { size: string; stock: number }[]): { size: string; stock: number }[] {
  const out = input.map((v) => ({ size: normalizeSizes([v.size])[0] ?? "", stock: v.stock }));
  if (out.some((v) => !v.size)) throw new Error("Talla vacía");
  if (new Set(out.map((v) => v.size)).size !== out.length) throw new Error("Talla duplicada");
  return out;
}

async function insertStockMovement(q: Q, variantId: number, delta: number) {
  await q.insert(stockMovements).values({ variantId, delta, reason: "manual", orderId: null });
}

export async function createProductFull(db: Db, input: ProductInput): Promise<{ id: number; slug: string; modelId: string }> {
  const sizes = cleanVariants(input.variants);
  const colorName = collapse(input.colorName);
  const colorHex = input.colorHex.trim().toLowerCase();
  const images = [...new Set(input.images)];
  return db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const slug = await uniqueSlug(tx, slugify(`${input.name} ${colorName}`) || "producto");
    const modelId = input.modelId ?? crypto.randomUUID();
    const [p] = await tx.insert(products).values({
      name: input.name, slug, description: input.description, categoryId: input.categoryId,
      price: input.price, salePrice: input.salePrice, active: input.active,
      colorName, colorHex, modelId,
    }).returning({ id: products.id });
    if (images.length) {
      await tx.insert(productImages).values(images.map((url, position) => ({ productId: p.id, url, position })));
    }
    const rows = await tx.insert(variants).values(sizes.map((v) => ({ productId: p.id, size: v.size, stock: v.stock })))
      .returning({ id: variants.id, stock: variants.stock });
    for (const r of rows) if (r.stock > 0) await insertStockMovement(tx, r.id, r.stock);
    return { id: p.id, slug, modelId };
  });
}

/** Quita una variante: se borra si no tiene ventas; si las tiene, queda en stock 0 con movimiento. */
async function dropVariant(q: Q, v: { id: number; stock: number }) {
  const [{ n }] = await q.select({ n: count() }).from(orderItems).where(eq(orderItems.variantId, v.id));
  if (n > 0) {
    if (v.stock > 0) {
      await q.update(variants).set({ stock: 0 }).where(eq(variants.id, v.id));
      await insertStockMovement(q, v.id, -v.stock);
    }
  } else {
    await q.delete(variants).where(eq(variants.id, v.id));
  }
}

export async function updateProductFull(
  db: Db,
  id: number,
  input: ProductInput,
): Promise<{ id: number; slug: string; removedImages: string[] } | null> {
  const sizes = cleanVariants(input.variants);
  const colorName = collapse(input.colorName);
  const colorHex = input.colorHex.trim().toLowerCase();
  const images = [...new Set(input.images)];
  return db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const [p] = await tx.select().from(products).where(eq(products.id, id)).for("update");
    if (!p) return null;
    await tx.update(products).set({
      name: input.name, description: input.description, categoryId: input.categoryId,
      price: input.price, salePrice: input.salePrice, active: input.active,
      colorName, colorHex,
    }).where(eq(products.id, id));

    const before = await tx.select({ url: productImages.url }).from(productImages).where(eq(productImages.productId, id));
    await tx.delete(productImages).where(eq(productImages.productId, id));
    if (images.length) {
      await tx.insert(productImages).values(images.map((url, position) => ({ productId: id, url, position })));
    }
    const removedImages = before.map((b) => b.url).filter((u) => !images.includes(u));

    const existing = await tx.select({ id: variants.id, size: variants.size, stock: variants.stock })
      .from(variants).where(eq(variants.productId, id)).orderBy(asc(variants.id)).for("update");
    const bySize = new Map(existing.map((v) => [v.size, v]));
    const wanted = new Set(sizes.map((s) => s.size));
    for (const v of existing) if (!wanted.has(v.size)) await dropVariant(tx, v);
    for (const s of sizes) {
      if (bySize.has(s.size)) continue; // el stock de tallas existentes solo se ajusta con adjustStock
      const [row] = await tx.insert(variants).values({ productId: id, size: s.size, stock: s.stock }).returning({ id: variants.id });
      if (s.stock > 0) await insertStockMovement(tx, row.id, s.stock);
    }
    return { id, slug: p.slug, removedImages };
  });
}

export async function hasOrders(db: Db, productId: number): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(orderItems)
    .innerJoin(variants, eq(orderItems.variantId, variants.id)).where(eq(variants.productId, productId));
  return n > 0;
}

export async function deleteProduct(
  db: Db,
  id: number,
): Promise<{ status: "deleted"; imageUrls: string[] } | { status: "has_orders" } | { status: "not_found" }> {
  return db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.id, id)).for("update");
    if (!p) return { status: "not_found" as const };
    // FOR UPDATE choca con el FOR KEY SHARE que toma el INSERT de order_items (FK): o el borrado espera
    // y recuenta con snapshot nuevo, o el checkout espera y falla por FK. Mismo patrón que updateProductFull.
    await tx.select({ id: variants.id }).from(variants).where(eq(variants.productId, id)).orderBy(asc(variants.id)).for("update");
    if (await hasOrders(tx, id)) return { status: "has_orders" as const };
    const imgs = await tx.select({ url: productImages.url }).from(productImages)
      .where(eq(productImages.productId, id)).orderBy(asc(productImages.position), asc(productImages.id));
    await tx.delete(products).where(eq(products.id, id));
    return { status: "deleted" as const, imageUrls: imgs.map((i) => i.url) };
  });
}

export async function getProductEditData(db: Db, id: number) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) return null;
  const [images, vs, siblings] = await Promise.all([
    db.select({ url: productImages.url }).from(productImages).where(eq(productImages.productId, id))
      .orderBy(asc(productImages.position), asc(productImages.id)),
    db.select({ id: variants.id, size: variants.size, stock: variants.stock }).from(variants).where(eq(variants.productId, id)).orderBy(asc(variants.id)),
    db.select({ id: products.id, slug: products.slug, colorName: products.colorName, colorHex: products.colorHex, active: products.active })
      .from(products).where(and(eq(products.modelId, product.modelId), ne(products.id, id))).orderBy(asc(products.id)),
  ]);
  return { product, images, variants: vs, siblings };
}
