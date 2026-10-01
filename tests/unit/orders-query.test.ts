import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createOrder, confirmOrder } from "@/server/orders";
import { listOrders, getOrderDetail } from "@/server/orders-query";
import { orders, variants } from "@/db/schema";

describe("orders-query", () => {
  it("filtra por estado y busca por código, nombre y teléfono", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db);
    const a = await createOrder(db, { name: "Juan Pérez", phone: "3001112222", items: [{ variantId: v, qty: 1 }] });
    await createOrder(db, { name: "Ana Gómez", phone: "3203334444", items: [{ variantId: v, qty: 1 }] });
    if (a.ok) await confirmOrder(db, a.data.orderId);
    expect((await listOrders(db, { status: "confirmed" })).rows.map((r) => r.customerName)).toEqual(["Juan Pérez"]);
    expect((await listOrders(db, { q: "OFF-0002" })).rows.map((r) => r.customerName)).toEqual(["Ana Gómez"]);
    expect((await listOrders(db, { q: "gómez" })).rows).toHaveLength(1);
    expect((await listOrders(db, { q: "3001112222" })).rows).toHaveLength(1);
    expect((await listOrders(db, {})).total).toBe(2);
  });
  it("detalle incluye stock actual por ítem", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 4 }] });
    const r = await createOrder(db, { name: "Juan", phone: "3001112222", items: [{ variantId: v, qty: 1 }] });
    if (!r.ok) throw new Error("setup");
    const d = await getOrderDetail(db, r.data.orderId);
    expect(d!.items[0].currentStock).toBe(4);
    expect(await getOrderDetail(db, 9999)).toBeNull();
  });
  it("el límite 'to' es inclusivo y 'from' acota por abajo", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db);
    const r = await createOrder(db, { name: "Juan", phone: "3001112222", items: [{ variantId: v, qty: 1 }] });
    if (!r.ok) throw new Error("setup");
    const at = new Date("2026-03-10T12:00:00.000Z");
    await db.update(orders).set({ createdAt: at }).where(eq(orders.id, r.data.orderId));
    expect((await listOrders(db, { to: at })).rows).toHaveLength(1);
    expect((await listOrders(db, { from: at })).rows).toHaveLength(1);
    expect((await listOrders(db, { to: new Date(at.getTime() - 1) })).rows).toHaveLength(0);
    expect((await listOrders(db, { from: new Date(at.getTime() + 1) })).rows).toHaveLength(0);
  });
  it("pagina de a 20, más nuevos primero, con total independiente de la página", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 100 }] });
    for (let i = 0; i < 23; i++) {
      const r = await createOrder(db, { name: `Cliente ${i}`, phone: "3001112222", items: [{ variantId: v, qty: 1 }] });
      if (!r.ok) throw new Error("setup");
      await db.update(orders).set({ createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)) }).where(eq(orders.id, r.data.orderId));
    }
    const p1 = await listOrders(db, { page: 1 });
    const p2 = await listOrders(db, { page: 2 });
    expect(p1.rows).toHaveLength(20);
    expect(p2.rows).toHaveLength(3);
    expect(p1.total).toBe(23);
    expect(p2.total).toBe(23);
    expect(p1.rows[0].customerName).toBe("Cliente 22");
    expect(p2.rows.map((r) => r.customerName)).toEqual(["Cliente 2", "Cliente 1", "Cliente 0"]);
  });
  it("escapa % y _ en la búsqueda (no actúan como comodín)", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db);
    await createOrder(db, { name: "Juan Pérez", phone: "3001112222", items: [{ variantId: v, qty: 1 }] });
    await createOrder(db, { name: "100%_Real", phone: "3203334444", items: [{ variantId: v, qty: 1 }] });
    expect((await listOrders(db, { q: "%" })).rows.map((r) => r.customerName)).toEqual(["100%_Real"]);
    expect((await listOrders(db, { q: "_" })).rows.map((r) => r.customerName)).toEqual(["100%_Real"]);
    expect((await listOrders(db, { q: "J_an" })).rows).toHaveLength(0);
  });
  it("variante eliminada: currentStock null", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db);
    const r = await createOrder(db, { name: "Juan", phone: "3001112222", items: [{ variantId: v, qty: 1 }] });
    if (!r.ok) throw new Error("setup");
    await db.delete(variants).where(eq(variants.id, v));
    const d = await getOrderDetail(db, r.data.orderId);
    expect(d!.items[0].currentStock).toBeNull();
  });
});
