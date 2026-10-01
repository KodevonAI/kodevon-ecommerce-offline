import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { Db } from "@/db/client";

export async function makeTestDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  return db as unknown as Db;
}

export async function seedProduct(
  db: Db,
  o: {
    name?: string; price?: number; salePrice?: number | null; active?: boolean;
    color?: string; colorHex?: string; modelId?: string; images?: string[];
    variants?: { size: string; color?: string; stock: number }[];
  } = {},
) {
  const name = o.name ?? "Camiseta Oversize";
  const vs = o.variants ?? [{ size: "M", stock: 5 }];
  const color = o.color ?? vs.find((v) => v.color)?.color ?? "Negro";
  if (new Set(vs.map((v) => v.color ?? color)).size > 1) throw new Error("seedProduct: un producto tiene un solo color");
  const colorHex = o.colorHex ?? "#000000";
  const modelId = o.modelId ?? `m-${Math.random().toString(36).slice(2, 10)}`;
  const [p] = await db.insert(schema.products).values({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${color.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`,
    price: o.price ?? 89900,
    salePrice: o.salePrice ?? null,
    active: o.active ?? true,
    colorName: color,
    colorHex,
    modelId,
  }).returning();
  if (o.images?.length) {
    await db.insert(schema.productImages).values(o.images.map((url, position) => ({ productId: p.id, url, position })));
  }
  // DEPRECADO: columnas legacy de variants, se quitan en la migración de limpieza
  // (catalog.ts/orders.ts aún leen variants.color_name hasta la Task 4).
  const rows = vs.length === 0 ? [] : await db.insert(schema.variants).values(
    vs.map((v) => ({ productId: p.id, size: v.size, stock: v.stock, colorName: color, colorHex })),
  ).returning();
  return { productId: p.id, variantIds: rows.map((r) => r.id), modelId };
}
