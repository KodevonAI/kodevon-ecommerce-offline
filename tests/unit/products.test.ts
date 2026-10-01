import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createProduct, generateVariants, normalizeSizes, parseColorLines, removeVariant, addImage, moveImage } from "@/server/products";
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

  it("generateVariants normaliza tallas y deduplica colores sin distinguir mayúsculas", async () => {
    const db = await makeTestDb();
    const { id } = await createProduct(db, base);
    const n = await generateVariants(db, id, [" m ", "M", "x  l"], [{ name: "  Azul   Rey ", hex: "#000080" }, { name: "azul rey", hex: "#111111" }]);
    expect(n).toBe(2);
    const vs = await db.select().from(variants).where(eq(variants.productId, id));
    expect(vs.map((v) => v.size).sort()).toEqual(["M", "X L"]);
    expect(new Set(vs.map((v) => v.colorName))).toEqual(new Set(["Azul Rey"]));
    expect(vs[0].colorHex).toBe("#000080");
  });

  it("normalizeSizes pasa a mayúsculas y colapsa espacios", () => {
    expect(normalizeSizes(["s", " S ", "xl", "", "2  xl"])).toEqual(["S", "XL", "2 XL"]);
  });

  it("parseColorLines acepta nombre:#hex, colapsa espacios y deduplica", () => {
    expect(parseColorLines("Negro:#151515\n  verde   oscuro : #00ff00 \nNEGRO:#000000\nBlanco\nGris:")).toEqual({
      colors: [
        { name: "Negro", hex: "#151515" },
        { name: "verde oscuro", hex: "#00ff00" },
        { name: "Blanco", hex: "#000000" },
        { name: "Gris", hex: "#000000" },
      ],
    });
  });

  it("parseColorLines rechaza un sufijo hex inválido en vez de volverlo parte del nombre", () => {
    expect(parseColorLines("Negro:#zzz")).toEqual({ error: expect.stringContaining("Negro:#zzz") });
    expect(parseColorLines("Rojo:#fff")).toHaveProperty("error");
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
