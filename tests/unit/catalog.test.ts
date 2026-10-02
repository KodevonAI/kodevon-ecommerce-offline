import { describe, it, expect } from "vitest";
import { makeTestDb, seedProduct } from "../helpers/db";
import { listProducts, getProductBySlug, getCartLines, getFilterOptions, redactInactiveLines, bestsellerIds } from "@/server/catalog";
import { createOrder, confirmOrder } from "@/server/orders";
import { slugify } from "@/lib/slug";
import { categories, products } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("slugify", () => {
  it("quita tildes y símbolos", () => expect(slugify("Camiseta Básica Ñandú!")).toBe("camiseta-basica-nandu"));
});

describe("listProducts", () => {
  it("oculta inactivos y marca agotados", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "Activo" });
    await seedProduct(db, { name: "Oculto", active: false });
    await seedProduct(db, { name: "Agotado", variants: [{ size: "M", color: "Negro", stock: 0 }] });
    const r = await listProducts(db, {});
    expect(r.map((p) => p.name).sort()).toEqual(["Activo", "Agotado"]);
    expect(r.find((p) => p.name === "Agotado")!.inStock).toBe(false);
  });

  it("filtra por talla, color, oferta, rango de precio y búsqueda", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "Hoodie Negro", price: 150000, variants: [{ size: "L", color: "Negro", stock: 2 }] });
    await seedProduct(db, { name: "Camiseta Blanca", price: 60000, salePrice: 50000, variants: [{ size: "M", color: "Blanco", stock: 2 }] });
    expect((await listProducts(db, { size: "L" })).map((p) => p.name)).toEqual(["Hoodie Negro"]);
    expect((await listProducts(db, { color: "Blanco" })).map((p) => p.name)).toEqual(["Camiseta Blanca"]);
    expect((await listProducts(db, { sale: true })).map((p) => p.name)).toEqual(["Camiseta Blanca"]);
    expect((await listProducts(db, { min: 100000 })).map((p) => p.name)).toEqual(["Hoodie Negro"]);
    expect((await listProducts(db, { q: "hood" })).map((p) => p.name)).toEqual(["Hoodie Negro"]);
  });

  it("filtra por categoría (slug)", async () => {
    const db = await makeTestDb();
    const [c] = await db.insert(categories).values({ name: "Hoodies", slug: "hoodies" }).returning();
    const { productId } = await seedProduct(db, { name: "H1" });
    await seedProduct(db, { name: "Otro" });
    await db.update(products).set({ categoryId: c.id }).where(eq(products.id, productId));
    expect((await listProducts(db, { category: "hoodies" })).map((p) => p.name)).toEqual(["H1"]);
  });

  it("ordena por precio efectivo", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "A", price: 100000, salePrice: 40000 });
    await seedProduct(db, { name: "B", price: 70000 });
    expect((await listProducts(db, { sort: "price_asc" })).map((p) => p.name)).toEqual(["A", "B"]);
  });

  it("la búsqueda escapa % y _ y se ignoran números no finitos", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "Hoodie" });
    await seedProduct(db, { name: "Descuento 50% off" });
    expect((await listProducts(db, { q: "%" })).map((p) => p.name)).toEqual(["Descuento 50% off"]);
    expect((await listProducts(db, { q: "_" })).length).toBe(0);
    expect((await listProducts(db, { min: NaN, max: Infinity })).length).toBe(2);
  });
});

describe("getProductBySlug / getCartLines", () => {
  it("devuelve null para inactivo o inexistente", async () => {
    const db = await makeTestDb();
    const { productId } = await seedProduct(db, { name: "X", active: false });
    const [p] = await db.select().from(products).where(eq(products.id, productId));
    expect(await getProductBySlug(db, p.slug)).toBeNull();
    expect(await getProductBySlug(db, "no-existe")).toBeNull();
  });
  it("getCartLines usa precio efectivo y reporta active/stock", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db, { price: 100, salePrice: 80, variants: [{ size: "M", color: "Negro", stock: 4 }] });
    const [l] = await getCartLines(db, variantIds);
    expect(l).toMatchObject({ price: 80, stock: 4, active: true, size: "M", colorName: "Negro" });
    expect(await getCartLines(db, [])).toEqual([]);
  });
  it("redactInactiveLines oculta precio/stock/imagen/slug de productos inactivos", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db, { price: 100, active: false, variants: [{ size: "M", color: "Negro", stock: 4 }] });
    const [l] = redactInactiveLines(await getCartLines(db, variantIds));
    expect(l).toEqual({ variantId: variantIds[0], active: false, productName: expect.any(String), colorName: "Negro", size: "M", slug: "", price: 0, stock: 0, image: null });
  });
});

describe("colores como productos", () => {
  it("tarjetas: los demás colores del mismo modelo, solo activos y solo del mismo modelo", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { name: "Blusa", color: "Rojo", colorHex: "#ff0000", modelId: "m1" });
    await seedProduct(db, { name: "Blusa", color: "Negro", colorHex: "#000000", modelId: "m1" });
    await seedProduct(db, { name: "Blusa", color: "Azul", colorHex: "#1976d2", modelId: "m1", active: false }); // archivado
    await seedProduct(db, { name: "Otra", color: "Verde", colorHex: "#388e3c", modelId: "m2" });
    const cards = await listProducts(db, {});
    const rojo = cards.find((c) => c.colorName === "Rojo")!;
    expect(rojo.colors.map((c) => c.colorName)).toEqual(["Negro"]);
    expect(cards.find((c) => c.name === "Otra")!.colors).toEqual([]);
    expect(cards).toHaveLength(3); // el archivado no se lista
    expect(a.productId).toBeGreaterThan(0);
  });

  it("producto: siblings incluye el actual y excluye archivados y otros modelos; variantes sin color", async () => {
    const db = await makeTestDb();
    const r = await seedProduct(db, { name: "Blusa", color: "Rojo", colorHex: "#ff0000", modelId: "m1", variants: [{ size: "S", stock: 2 }] });
    await seedProduct(db, { name: "Blusa", color: "Negro", colorHex: "#000000", modelId: "m1", variants: [{ size: "S", stock: 0 }] });
    await seedProduct(db, { name: "Blusa", color: "Azul", colorHex: "#1976d2", modelId: "m1", active: false });
    await seedProduct(db, { name: "Otra", color: "Verde", modelId: "m2" });
    const [p] = await db.select().from(products).where(eq(products.id, r.productId));
    const d = await getProductBySlug(db, p.slug);
    expect(d!.colorName).toBe("Rojo");
    expect(d!.siblings.map((s) => [s.colorName, s.inStock])).toEqual([["Rojo", true], ["Negro", false]]);
    expect(d!.variants[0]).toEqual({ id: expect.any(Number), size: "S", stock: 2 });
    expect(d!.variants[0]).not.toHaveProperty("colorName");
  });

  it("filtro por color usa el color del producto y las opciones salen de productos activos", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "A", color: "Rojo", colorHex: "#ff0000" });
    await seedProduct(db, { name: "B", color: "Negro", colorHex: "#000000" });
    await seedProduct(db, { name: "C", color: "Azul", colorHex: "#1976d2", active: false });
    expect((await listProducts(db, { color: "Rojo" })).map((p) => p.name)).toEqual(["A"]);
    const o = await getFilterOptions(db);
    expect(o.colors.map((c) => c.name)).toEqual(["Negro", "Rojo"]);
  });

  it("opciones de color: una entrada por nombre (primer hex) y orden alfabético en español", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "A", color: "Verde", colorHex: "#00ff00" });
    await seedProduct(db, { name: "B", color: "Verde", colorHex: "#00aa00" });
    await seedProduct(db, { name: "C", color: "Ámbar", colorHex: "#ffbf00" });
    await seedProduct(db, { name: "D", color: "azul", colorHex: "#1976d2" });
    await seedProduct(db, { name: "E", color: "Zafiro", colorHex: "#0f52ba" });
    const o = await getFilterOptions(db);
    expect(o.colors.map((c) => c.name)).toEqual(["Ámbar", "azul", "Verde", "Zafiro"]);
    expect(o.colors.filter((c) => c.name === "Verde")).toHaveLength(1);
    expect(["#00ff00", "#00aa00"]).toContain(o.colors.find((c) => c.name === "Verde")!.hex);
  });

  it("líneas de carrito toman el color del producto", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db, { color: "Vino", colorHex: "#7b1e3a" });
    const [l] = await getCartLines(db, variantIds);
    expect(l.colorName).toBe("Vino");
  });
});

describe("categorías visibles", () => {
  it("solo aparecen las categorías con al menos un producto activo", async () => {
    const db = await makeTestDb();
    const [con, sinActivos, vacia] = await db.insert(categories).values([
      { name: "Camisetas", slug: "camisetas", position: 1 },
      { name: "Buzos", slug: "buzos", position: 2 },
      { name: "Pantalones", slug: "pantalones", position: 3 },
    ]).returning();
    const a = await seedProduct(db, { name: "Activa" });
    const b = await seedProduct(db, { name: "Archivada", active: false });
    await db.update(products).set({ categoryId: con.id }).where(eq(products.id, a.productId));
    await db.update(products).set({ categoryId: sinActivos.id }).where(eq(products.id, b.productId));
    expect(vacia.slug).toBe("pantalones");
    expect((await getFilterOptions(db)).categories.map((c) => c.slug)).toEqual(["camisetas"]);
    // al activar el producto de "buzos" la categoría reaparece, en su orden
    await db.update(products).set({ active: true }).where(eq(products.id, b.productId));
    expect((await getFilterOptions(db)).categories.map((c) => c.slug)).toEqual(["camisetas", "buzos"]);
  });
});

describe("favoritos y más vendidos", () => {
  it("ids y slugs filtran; un arreglo vacío no devuelve nada", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { name: "Camiseta A" });
    const b = await seedProduct(db, { name: "Camiseta B" });
    const [{ slug }] = await db.select({ slug: products.slug }).from(products).where(eq(products.id, b.productId));
    expect((await listProducts(db, { ids: [a.productId] })).map((p) => p.id)).toEqual([a.productId]);
    expect(await listProducts(db, { ids: [] })).toEqual([]);
    expect(await listProducts(db, { slugs: [] })).toEqual([]);
    expect((await listProducts(db, { slugs: [slug] })).map((p) => p.id)).toEqual([b.productId]);
  });

  it("bestsellerIds ordena por unidades confirmadas y excluye pendientes", async () => {
    const db = await makeTestDb();
    const low = await seedProduct(db, { name: "Poco", variants: [{ size: "M", stock: 10 }] });
    const top = await seedProduct(db, { name: "Mucho", variants: [{ size: "M", stock: 10 }] });
    const pending = await seedProduct(db, { name: "Pendiente", variants: [{ size: "M", stock: 10 }] });
    const buy = async (variantId: number, qty: number, confirm = true) => {
      const r = await createOrder(db, { name: "Ana", phone: "3001234567", items: [{ variantId, qty }] });
      if (!r.ok) throw new Error("setup");
      if (confirm) await confirmOrder(db, r.data.orderId);
    };
    await buy(low.variantIds[0], 1);
    await buy(top.variantIds[0], 3);
    await buy(pending.variantIds[0], 5, false);
    expect(await bestsellerIds(db, 8)).toEqual([top.productId, low.productId]);
    expect(await bestsellerIds(db, 1)).toEqual([top.productId]);
  });
});
