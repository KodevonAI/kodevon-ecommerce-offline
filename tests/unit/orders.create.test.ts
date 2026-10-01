import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createOrder } from "@/server/orders";
import { orders, orderItems, variants } from "@/db/schema";

const who = { name: "Juan", phone: "3001234567" };

describe("createOrder", () => {
  it("crea pendiente, usa precio de oferta, snapshot y NO toca stock", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db, { price: 100000, salePrice: 80000, variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const r = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty: 2 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.code).toBe("OFF-0001");
    expect(r.data.total).toBe(160000);
    const [o] = await db.select().from(orders).where(eq(orders.id, r.data.orderId));
    expect(o.status).toBe("pending");
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    expect(items[0]).toMatchObject({ unitPrice: 80000, qty: 2, size: "M", colorName: "Negro" });
    const [v] = await db.select().from(variants).where(eq(variants.id, variantIds[0]));
    expect(v.stock).toBe(5);
  });

  it("códigos consecutivos", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db);
    const a = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty: 1 }] });
    const b = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty: 1 }] });
    expect(a.ok && a.data.code).toBe("OFF-0001");
    expect(b.ok && b.data.code).toBe("OFF-0002");
  });

  it("suma líneas repetidas de la misma variante antes de validar stock", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 3 }] });
    const r = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty: 2 }, { variantId: variantIds[0], qty: 2 }] });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.code === "invalid_items") {
      expect(r.error.issues[0]).toMatchObject({ variantId: variantIds[0], reason: "insufficient", available: 3 });
    }
    const ok = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty: 1 }, { variantId: variantIds[0], qty: 2 }] });
    expect(ok.ok && ok.data.lines).toHaveLength(1);
    expect(ok.ok && ok.data.lines[0].qty).toBe(3);
  });

  it("rechaza inactivo, inexistente y sin stock sin crear pedido", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { active: false });
    const b = await seedProduct(db, { variants: [{ size: "S", color: "Blanco", stock: 0 }] });
    const r = await createOrder(db, { ...who, items: [
      { variantId: a.variantIds[0], qty: 1 }, { variantId: 99999, qty: 1 }, { variantId: b.variantIds[0], qty: 1 },
    ] });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.code === "invalid_items") {
      expect(r.error.issues.map((i) => i.reason).sort()).toEqual(["inactive", "insufficient", "not_found"]);
    }
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it.each([0, -1, 1.5, 1e9])("rechaza qty inválida %s", async (qty) => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db);
    const r = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty }] });
    expect(r.ok).toBe(false);
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it("carrito vacío falla", async () => {
    const db = await makeTestDb();
    expect((await createOrder(db, { ...who, items: [] })).ok).toBe(false);
  });
});
