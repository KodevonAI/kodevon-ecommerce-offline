import { describe, it, expect } from "vitest";
import { makeTestDb, seedProduct } from "../helpers/db";
import { listProducts, getProductBySlug, getCartLines } from "@/server/catalog";
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
});
