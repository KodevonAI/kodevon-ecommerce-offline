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
    variants?: { size: string; color: string; stock: number }[];
  } = {},
) {
  const name = o.name ?? "Camiseta Oversize";
  const [p] = await db.insert(schema.products).values({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`,
    price: o.price ?? 89900,
    salePrice: o.salePrice ?? null,
    active: o.active ?? true,
  }).returning();
  const vs = o.variants ?? [{ size: "M", color: "Negro", stock: 5 }];
  const rows = await db.insert(schema.variants).values(
    vs.map((v) => ({ productId: p.id, size: v.size, colorName: v.color, stock: v.stock })),
  ).returning();
  return { productId: p.id, variantIds: rows.map((r) => r.id) };
}
