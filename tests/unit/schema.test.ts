import { describe, it, expect } from "vitest";
import { sql, eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { variants } from "@/db/schema";

describe("schema", () => {
  it("rechaza stock negativo", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db);
    await expect(
      db.update(variants).set({ stock: -1 }).where(eq(variants.id, variantIds[0])),
    ).rejects.toThrow();
  });

  it("rechaza variante duplicada (producto,talla,color)", async () => {
    const db = await makeTestDb();
    await expect(
      seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 1 }, { size: "M", color: "Negro", stock: 1 }] }),
    ).rejects.toThrow();
  });

  it("secuencia de códigos existe", async () => {
    const db = await makeTestDb();
    const r = (await db.execute(sql`select nextval('order_code_seq') as n`)) as unknown as { rows: { n: string }[] };
    expect(Number(r.rows[0].n)).toBeGreaterThanOrEqual(1);
  });
});
