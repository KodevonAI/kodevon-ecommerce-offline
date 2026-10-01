import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createProduct, generateVariants, removeVariant, addImage, moveImage } from "@/server/products";
import { createOrder } from "@/server/orders";
import { variants, productImages, stockMovements } from "@/db/schema";

const base = { name: "Hoodie Basic", description: "", categoryId: null, price: 150000, salePrice: null, active: true };

describe("products", () => {
  it("createProduct genera slug único", async () => {
    const db = await makeTestDb();
    const a = await createProduct(db, base);
    const b = await createProduct(db, base);
    expect(a.slug).toBe("hoodie-basic");
    expect(b.slug).toBe("hoodie-basic-2");
  });

  it("generateVariants crea solo las combinaciones faltantes", async () => {
    const db = await makeTestDb();
    const { id } = await createProduct(db, base);
    expect(await generateVariants(db, id, ["S", "M"], [{ name: "Negro", hex: "#000000" }])).toBe(2);
    expect(await generateVariants(db, id, ["S", "M", "L"], [{ name: "Negro", hex: "#000000" }])).toBe(1);
    expect(await db.select().from(variants).where(eq(variants.productId, id))).toHaveLength(3);
  });

  it("removeVariant borra si no tiene ventas y pone stock 0 si las tiene", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }, { size: "L", color: "Negro", stock: 5 }] });
    const r = await createOrder(db, { name: "Juan", phone: "3001234567", items: [{ variantId: a.variantIds[0], qty: 1 }] });
    expect(r.ok).toBe(true);
    expect(await removeVariant(db, a.variantIds[0])).toBe("zeroed");
    expect(await removeVariant(db, a.variantIds[1])).toBe("deleted");
    const [v] = await db.select().from(variants).where(eq(variants.id, a.variantIds[0]));
    expect(v.stock).toBe(0);
    const mv = await db.select().from(stockMovements).where(eq(stockMovements.variantId, a.variantIds[0]));
    expect(mv.some((m) => m.reason === "manual" && m.delta === -5)).toBe(true);
  });

  it("imágenes se ordenan y moveImage intercambia posiciones", async () => {
    const db = await makeTestDb();
    const { id } = await createProduct(db, base);
    await addImage(db, id, "a.jpg"); await addImage(db, id, "b.jpg");
    let imgs = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.position);
    expect(imgs.map((i) => i.url)).toEqual(["a.jpg", "b.jpg"]);
    await moveImage(db, imgs[1].id, "up");
    imgs = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.position);
    expect(imgs.map((i) => i.url)).toEqual(["b.jpg", "a.jpg"]);
  });

  it("moveImage hacia abajo intercambia y los extremos no cambian", async () => {
    const db = await makeTestDb();
    const { id } = await createProduct(db, base);
    for (const u of ["a.jpg", "b.jpg", "c.jpg"]) await addImage(db, id, u);
    const list = () => db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.position);
    let imgs = await list();
    await moveImage(db, imgs[0].id, "down");
    imgs = await list();
    expect(imgs.map((i) => i.url)).toEqual(["b.jpg", "a.jpg", "c.jpg"]);
    expect(imgs.map((i) => i.position)).toEqual([0, 1, 2]);
    await moveImage(db, imgs[2].id, "down");
    await moveImage(db, imgs[0].id, "up");
    expect((await list()).map((i) => i.url)).toEqual(["b.jpg", "a.jpg", "c.jpg"]);
  });
});
