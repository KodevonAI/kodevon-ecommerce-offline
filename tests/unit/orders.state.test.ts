import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createOrder, confirmOrder, cancelOrder, adjustStock } from "@/server/orders";
import { orders, variants, stockMovements } from "@/db/schema";
import type { Db } from "@/db/client";

const who = { name: "Juan", phone: "3001234567" };
const stockOf = async (db: Db, id: number) => (await db.select().from(variants).where(eq(variants.id, id)))[0].stock;
async function pending(db: Db, variantId: number, qty: number) {
  const r = await createOrder(db, { ...who, items: [{ variantId, qty }] });
  if (!r.ok) throw new Error("setup");
  return r.data.orderId;
}

describe("confirmOrder", () => {
  it("descuenta stock, marca confirmed y registra movimiento", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const id = await pending(db, v, 2);
    const r = await confirmOrder(db, id);
    expect(r.ok).toBe(true);
    expect(await stockOf(db, v)).toBe(3);
    const [o] = await db.select().from(orders).where(eq(orders.id, id));
    expect(o.status).toBe("confirmed");
    expect(o.confirmedAt).not.toBeNull();
    const mv = await db.select().from(stockMovements);
    expect(mv).toMatchObject([{ variantId: v, delta: -2, reason: "order_confirmed", orderId: id }]);
  });

  it("stock insuficiente aborta TODO sin cambios parciales", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const b = await seedProduct(db, { name: "Hoodie", variants: [{ size: "L", color: "Gris", stock: 2 }] });
    const r1 = await createOrder(db, { ...who, items: [{ variantId: a.variantIds[0], qty: 3 }, { variantId: b.variantIds[0], qty: 2 }] });
    if (!r1.ok) throw new Error("setup");
    await adjustStock(db, b.variantIds[0], -1); // ahora b tiene 1
    const r = await confirmOrder(db, r1.data.orderId);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.code === "insufficient_stock") {
      expect(r.error.lines).toEqual([expect.objectContaining({ variantId: b.variantIds[0], needed: 2, available: 1 })]);
    }
    expect(await stockOf(db, a.variantIds[0])).toBe(5);
    expect(await stockOf(db, b.variantIds[0])).toBe(1);
    const [o] = await db.select().from(orders).where(eq(orders.id, r1.data.orderId));
    expect(o.status).toBe("pending");
  });

  it("doble confirmación no descuenta dos veces", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const id = await pending(db, v, 2);
    expect((await confirmOrder(db, id)).ok).toBe(true);
    const again = await confirmOrder(db, id);
    expect(again).toEqual({ ok: false, error: { code: "invalid_state" } });
    expect(await stockOf(db, v)).toBe(3);
  });

  it("dos pedidos por la última unidad: solo uno confirma", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 1 }] });
    const a = await pending(db, v, 1);
    const b = await pending(db, v, 1);
    const [ra, rb] = await Promise.all([confirmOrder(db, a), confirmOrder(db, b)]);
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1);
    expect(await stockOf(db, v)).toBe(0);
  });

  it("variante borrada → variant_missing sin cambios", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db);
    const id = await pending(db, v, 1);
    await db.delete(variants).where(eq(variants.id, v));
    const r = await confirmOrder(db, id);
    expect(r).toEqual({ ok: false, error: { code: "variant_missing" } });
    const [o] = await db.select().from(orders).where(eq(orders.id, id));
    expect(o.status).toBe("pending");
  });

  it("pedido inexistente → not_found", async () => {
    const db = await makeTestDb();
    expect(await confirmOrder(db, 12345)).toEqual({ ok: false, error: { code: "not_found" } });
  });
});

describe("cancelOrder", () => {
  it("pending → cancelled no toca stock", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const id = await pending(db, v, 2);
    const r = await cancelOrder(db, id);
    expect(r).toMatchObject({ ok: true, data: { restocked: false } });
    expect(await stockOf(db, v)).toBe(5);
  });

  it("confirmed → cancelled devuelve stock y registra movimiento", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const id = await pending(db, v, 2);
    await confirmOrder(db, id);
    const r = await cancelOrder(db, id);
    expect(r).toMatchObject({ ok: true, data: { restocked: true } });
    expect(await stockOf(db, v)).toBe(5);
    const mv = await db.select().from(stockMovements).where(eq(stockMovements.reason, "order_cancelled"));
    expect(mv).toMatchObject([{ delta: 2, orderId: id }]);
  });

  it("cancelled no se puede cancelar ni confirmar; no devuelve stock dos veces", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const id = await pending(db, v, 2);
    await confirmOrder(db, id);
    await cancelOrder(db, id);
    expect(await cancelOrder(db, id)).toEqual({ ok: false, error: { code: "invalid_state" } });
    expect(await confirmOrder(db, id)).toEqual({ ok: false, error: { code: "invalid_state" } });
    expect(await stockOf(db, v)).toBe(5);
  });
});

describe("adjustStock", () => {
  it("suma/resta y registra; no permite bajar de 0", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 2 }] });
    expect(await adjustStock(db, v, 5)).toEqual({ ok: true, data: { stock: 7 } });
    const bad = await adjustStock(db, v, -10);
    expect(bad.ok).toBe(false);
    expect(await stockOf(db, v)).toBe(7);
    expect((await db.select().from(stockMovements).where(eq(stockMovements.reason, "manual")))).toHaveLength(1);
  });
});
