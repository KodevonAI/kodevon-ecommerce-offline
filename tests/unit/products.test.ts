import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../helpers/db";
import { createProductFull, updateProductFull, deleteProduct, getProductEditData, hasOrders, normalizeSizes } from "@/server/products";
import { createOrder, confirmOrder, cancelOrder } from "@/server/orders";
import { orderItems, productImages, products, stockMovements, variants } from "@/db/schema";

const BLOB = "https://abc123.public.blob.vercel-storage.com/products";
const base = {
  name: "Blusa Basic", description: "", categoryId: null, price: 50000, salePrice: null, active: true,
  colorName: "Rojo", colorHex: "#ff0000", images: [`${BLOB}/a.jpg`, `${BLOB}/b.jpg`],
  variants: [{ size: "S", stock: 3 }, { size: "M", stock: 0 }],
};
const who = { name: "Juan", phone: "3001234567" };
type TestDb = Awaited<ReturnType<typeof makeTestDb>>;
const count = async (db: TestDb, t: typeof products | typeof variants | typeof productImages | typeof stockMovements | typeof orderItems) =>
  (await db.select().from(t)).length;

describe("normalizeSizes", () => {
  it("pasa a mayúsculas y colapsa espacios", () => {
    expect(normalizeSizes(["s", " S ", "xl", "", "2  xl"])).toEqual(["S", "XL", "2 XL"]);
  });
});

describe("createProductFull", () => {
  it("crea producto + fotos + variantes + movimientos de stock inicial", async () => {
    const db = await makeTestDb();
    const r = await createProductFull(db, base);
    expect(r.slug).toBe("blusa-basic-rojo");
    expect(r.modelId).toBeTruthy();
    const imgs = await db.select().from(productImages).where(eq(productImages.productId, r.id)).orderBy(productImages.position);
    expect(imgs.map((i) => i.url)).toEqual(base.images);
    const vs = await db.select().from(variants).where(eq(variants.productId, r.id));
    expect(vs.map((v) => [v.size, v.stock]).sort()).toEqual([["M", 0], ["S", 3]]);
    const mv = await db.select().from(stockMovements);
    expect(mv).toHaveLength(1);
    expect(mv[0]).toMatchObject({ delta: 3, reason: "manual", orderId: null });
  });

  it("normaliza colorHex a minúsculas y colorName a espacios simples; el slug usa el nombre normalizado", async () => {
    const db = await makeTestDb();
    const r = await createProductFull(db, { ...base, colorName: "  Verde   oliva ", colorHex: "#FF00AA" });
    const [p] = await db.select().from(products).where(eq(products.id, r.id));
    expect(p.colorHex).toBe("#ff00aa");
    expect(p.colorName).toBe("Verde oliva");
    expect(r.slug).toBe("blusa-basic-verde-oliva");
  });

  it("dos productos con el mismo nombre y color: el segundo recibe sufijo, sin error", async () => {
    const db = await makeTestDb();
    const a = await createProductFull(db, base);
    const b = await createProductFull(db, base);
    expect(a.slug).toBe("blusa-basic-rojo");
    expect(b.slug).toBe("blusa-basic-rojo-2");
  });

  it("con modelId existente se une al grupo; sin modelId crea uno nuevo", async () => {
    const db = await makeTestDb();
    const a = await createProductFull(db, base);
    const b = await createProductFull(db, { ...base, colorName: "Negro", colorHex: "#000000", modelId: a.modelId });
    const c = await createProductFull(db, { ...base, colorName: "Azul", colorHex: "#1976d2" });
    expect(b.modelId).toBe(a.modelId);
    expect(c.modelId).not.toBe(a.modelId);
  });

  it("normaliza tallas y rechaza duplicadas sin crear nada", async () => {
    const db = await makeTestDb();
    const ok = await createProductFull(db, { ...base, variants: [{ size: " m ", stock: 1 }] });
    const [v] = await db.select().from(variants).where(eq(variants.productId, ok.id));
    expect(v.size).toBe("M");
    await expect(createProductFull(db, { ...base, variants: [{ size: "m", stock: 1 }, { size: "M", stock: 2 }] })).rejects.toThrow(/duplicada/i);
    expect(await count(db, products)).toBe(1);
  });

  it("es todo o nada: un fallo tras insertar el producto deshace todo", async () => {
    const db = await makeTestDb();
    // stock negativo viola el CHECK de variants después de insertar producto y fotos
    await expect(createProductFull(db, { ...base, variants: [{ size: "S", stock: -1 }] })).rejects.toThrow();
    expect(await count(db, products)).toBe(0);
    expect(await count(db, productImages)).toBe(0);
    expect(await count(db, stockMovements)).toBe(0);
    // categoría inexistente: falla en el primer insert
    await expect(createProductFull(db, { ...base, categoryId: 99999 })).rejects.toThrow();
    expect(await count(db, products)).toBe(0);
  });
});

describe("updateProductFull", () => {
  it("conserva el slug, reemplaza fotos y devuelve las quitadas", async () => {
    const db = await makeTestDb();
    const { id, slug } = await createProductFull(db, base);
    const r = await updateProductFull(db, id, { ...base, name: "Blusa Nueva", colorName: "Vino", colorHex: "#7b1e3a", images: [`${BLOB}/b.jpg`, `${BLOB}/c.jpg`] });
    expect(r).not.toBeNull();
    expect(r!.slug).toBe(slug);
    expect(r!.removedImages).toEqual([`${BLOB}/a.jpg`]);
    const [p] = await db.select().from(products).where(eq(products.id, id));
    expect(p).toMatchObject({ name: "Blusa Nueva", colorName: "Vino", colorHex: "#7b1e3a", slug });
    const imgs = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.position);
    expect(imgs.map((i) => i.url)).toEqual([`${BLOB}/b.jpg`, `${BLOB}/c.jpg`]);
  });

  it("normaliza colorHex a minúsculas y colorName a espacios simples", async () => {
    const db = await makeTestDb();
    const { id, slug } = await createProductFull(db, base);
    await updateProductFull(db, id, { ...base, colorName: "  Verde   oliva ", colorHex: "#FF00AA" });
    const [p] = await db.select().from(products).where(eq(products.id, id));
    expect(p).toMatchObject({ colorName: "Verde oliva", colorHex: "#ff00aa", slug });
  });

  it("añade tallas nuevas (con movimiento) y no cambia el stock de las existentes", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base); // S:3, M:0
    await updateProductFull(db, id, { ...base, variants: [{ size: "S", stock: 99 }, { size: "M", stock: 99 }, { size: "L", stock: 4 }] });
    const vs = Object.fromEntries((await db.select().from(variants).where(eq(variants.productId, id))).map((v) => [v.size, v.stock]));
    expect(vs).toEqual({ S: 3, M: 0, L: 4 });
    const mv = await db.select().from(stockMovements);
    expect(mv.map((m) => m.delta).sort()).toEqual([3, 4]);
  });

  it("quita una talla sin pedidos (se borra)", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base);
    await updateProductFull(db, id, { ...base, variants: [{ size: "S", stock: 0 }] });
    expect((await db.select().from(variants).where(eq(variants.productId, id))).map((v) => v.size)).toEqual(["S"]);
  });

  it("quitar una talla CON pedidos la deja en stock 0 con movimiento y no la borra", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base);
    const [s] = await db.select().from(variants).where(eq(variants.productId, id)).then((r) => r.filter((v) => v.size === "S"));
    const o = await createOrder(db, { ...who, items: [{ variantId: s.id, qty: 1 }] });
    expect(o.ok).toBe(true);
    await updateProductFull(db, id, { ...base, variants: [{ size: "M", stock: 0 }] });
    const after = await db.select().from(variants).where(eq(variants.id, s.id));
    expect(after).toHaveLength(1);
    expect(after[0].stock).toBe(0);
    const mv = await db.select().from(stockMovements).where(eq(stockMovements.variantId, s.id));
    expect(mv.map((m) => m.delta).sort()).toEqual([-3, 3]);
  });

  it("devuelve null si el producto no existe", async () => {
    const db = await makeTestDb();
    expect(await updateProductFull(db, 12345, base)).toBeNull();
  });
});

describe("deleteProduct", () => {
  it("borra un producto sin pedidos, con sus variantes/fotos/movimientos, y devuelve las fotos", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base);
    const r = await deleteProduct(db, id);
    expect(r).toEqual({ status: "deleted", imageUrls: base.images });
    expect(await count(db, products)).toBe(0);
    expect(await count(db, variants)).toBe(0);
    expect(await count(db, productImages)).toBe(0);
    expect(await count(db, stockMovements)).toBe(0);
  });

  it("con un pedido pendiente: has_orders y nada cambia", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base);
    const [s] = (await db.select().from(variants).where(eq(variants.productId, id))).filter((v) => v.size === "S");
    await createOrder(db, { ...who, items: [{ variantId: s.id, qty: 1 }] });
    expect(await deleteProduct(db, id)).toEqual({ status: "has_orders" });
    expect(await hasOrders(db, id)).toBe(true);
    expect(await count(db, products)).toBe(1);
  });

  it("aunque el único pedido esté cancelado, sigue siendo has_orders (queda el historial)", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base);
    const [s] = (await db.select().from(variants).where(eq(variants.productId, id))).filter((v) => v.size === "S");
    const o = await createOrder(db, { ...who, items: [{ variantId: s.id, qty: 1 }] });
    if (!o.ok) throw new Error("setup");
    await confirmOrder(db, o.data.orderId);
    await cancelOrder(db, o.data.orderId);
    expect(await deleteProduct(db, id)).toEqual({ status: "has_orders" });
    expect(await count(db, orderItems)).toBe(1);
  });

  it("not_found", async () => {
    const db = await makeTestDb();
    expect(await deleteProduct(db, 777)).toEqual({ status: "not_found" });
  });
});

describe("getProductEditData", () => {
  it("devuelve producto, fotos, variantes y hermanos del mismo modelo (incluye archivados con su estado)", async () => {
    const db = await makeTestDb();
    const a = await createProductFull(db, base);
    const b = await createProductFull(db, { ...base, colorName: "Negro", colorHex: "#000000", modelId: a.modelId, active: false });
    await createProductFull(db, { ...base, colorName: "Azul", colorHex: "#1976d2" }); // otro modelo
    const d = await getProductEditData(db, a.id);
    expect(d!.product.id).toBe(a.id);
    expect(d!.images.map((i) => i.url)).toEqual(base.images);
    expect(d!.variants.map((v) => v.size).sort()).toEqual(["M", "S"]);
    expect(d!.siblings.map((s) => [s.id, s.active])).toEqual([[b.id, false]]);
    expect(await getProductEditData(db, 999)).toBeNull();
  });
});
