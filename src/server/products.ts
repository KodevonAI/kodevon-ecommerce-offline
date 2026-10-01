import { asc, count, eq, like, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, productImages, products, stockMovements, variants } from "@/db/schema";
import { slugify } from "@/lib/slug";

export type ProductData = {
  name: string;
  description: string;
  categoryId: number | null;
  price: number;
  salePrice: number | null;
  active: boolean;
};

export async function createProduct(db: Db, data: ProductData): Promise<{ id: number; slug: string }> {
  const base = slugify(data.name) || "producto";
  const existing = await db.select({ slug: products.slug }).from(products).where(like(products.slug, `${base}%`));
  const taken = new Set(existing.map((r) => r.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  const [row] = await db.insert(products).values({ ...data, slug }).returning({ id: products.id, slug: products.slug });
  return row;
}

export async function updateProduct(db: Db, id: number, data: ProductData): Promise<void> {
  await db.update(products).set({
    name: data.name,
    description: data.description,
    categoryId: data.categoryId,
    price: data.price,
    salePrice: data.salePrice,
    active: data.active,
  }).where(eq(products.id, id));
}

const collapse = (s: string) => s.trim().replace(/\s+/g, " ");

/** Tallas: espacios colapsados, en mayúsculas y sin repetidos. */
export function normalizeSizes(sizes: string[]): string[] {
  return [...new Set(sizes.map((s) => collapse(s).toUpperCase()).filter(Boolean))];
}

/** Colores "Nombre:#hex" (uno por línea). Un sufijo tras ":" que no sea un hex válido es un error. */
export function parseColorLines(text: string): { colors: { name: string; hex: string }[] } | { error: string } {
  const colors: { name: string; hex: string }[] = [];
  const seen = new Set<string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const i = line.lastIndexOf(":");
    const suffix = i >= 0 ? line.slice(i + 1).trim() : "";
    if (suffix && !/^#[0-9a-fA-F]{6}$/.test(suffix)) return { error: `Color inválido "${line}": usa nombre:#RRGGBB` };
    const name = collapse(i >= 0 ? line.slice(0, i) : line);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push({ name, hex: suffix || "#000000" });
  }
  return { colors };
}

export async function generateVariants(
  db: Db,
  productId: number,
  sizes: string[],
  colors: { name: string; hex: string }[],
): Promise<number> {
  const cleanSizes = normalizeSizes(sizes);
  const seen = new Set<string>();
  const cleanColors = colors
    .map((c) => ({ name: collapse(c.name), hex: c.hex }))
    .filter((c) => c.name && !seen.has(c.name.toLowerCase()) && seen.add(c.name.toLowerCase()));
  const values = cleanSizes.flatMap((size) =>
    cleanColors.map((c) => ({ productId, size, colorName: c.name, colorHex: c.hex, stock: 0 })),
  );
  if (values.length === 0) return 0;
  const inserted = await db.insert(variants).values(values).onConflictDoNothing().returning({ id: variants.id });
  return inserted.length;
}

export async function removeVariant(db: Db, variantId: number): Promise<"deleted" | "zeroed"> {
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(variants).where(eq(variants.id, variantId)).for("update");
    if (!v) return "deleted" as const;
    const [{ n }] = await tx.select({ n: count() }).from(orderItems).where(eq(orderItems.variantId, variantId));
    if (n > 0) {
      // Con ventas: se conserva la variante (y su historial); solo se deja sin stock.
      if (v.stock > 0) {
        await tx.update(variants).set({ stock: 0 }).where(eq(variants.id, variantId));
        await tx.insert(stockMovements).values({ variantId, delta: -v.stock, reason: "manual", orderId: null });
      }
      return "zeroed" as const;
    }
    await tx.delete(variants).where(eq(variants.id, variantId));
    return "deleted" as const;
  });
}

export async function addImage(db: Db, productId: number, url: string): Promise<void> {
  await db.insert(productImages).values({
    productId,
    url,
    position: sql<number>`(select coalesce(max(${productImages.position}), -1) + 1 from ${productImages} where ${productImages.productId} = ${productId})`,
  });
}

export async function removeImage(db: Db, imageId: number): Promise<void> {
  await db.delete(productImages).where(eq(productImages.id, imageId));
}

export async function moveImage(db: Db, imageId: number, dir: "up" | "down"): Promise<void> {
  await db.transaction(async (tx) => {
    const [img] = await tx.select().from(productImages).where(eq(productImages.id, imageId));
    if (!img) return;
    const siblings = await tx.select().from(productImages)
      .where(eq(productImages.productId, img.productId))
      .orderBy(asc(productImages.position), asc(productImages.id));
    const idx = siblings.findIndex((s) => s.id === imageId);
    const j = idx + (dir === "up" ? -1 : 1);
    if (!siblings[j]) return;
    // Se reescriben posiciones contiguas para ser robustos ante empates.
    const order = siblings.map((s) => s.id);
    [order[idx], order[j]] = [order[j], order[idx]];
    for (let i = 0; i < order.length; i++) {
      await tx.update(productImages).set({ position: i }).where(eq(productImages.id, order[i]));
    }
  });
}
