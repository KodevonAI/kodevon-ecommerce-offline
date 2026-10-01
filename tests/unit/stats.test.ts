import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createOrder, confirmOrder, cancelOrder } from "@/server/orders";
import { getSummary, salesByDay, topProducts, lowStock, resolveRange } from "@/server/stats";
import { orders } from "@/db/schema";
import type { Db } from "@/db/client";

const who = { name: "Juan", phone: "3001234567" };
const wide = { from: new Date("2000-01-01"), to: new Date("2100-01-01") };

async function sale(db: Db, variantId: number, qty: number) {
  const r = await createOrder(db, { ...who, items: [{ variantId, qty }] });
  if (!r.ok) throw new Error("setup");
  await confirmOrder(db, r.data.orderId);
  return r.data.orderId;
}

describe("stats", () => {
  it("solo cuenta confirmadas; cancelados y pendientes no suman ventas", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { price: 100000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    await sale(db, v, 2);                                   // 200000
    const c = await sale(db, v, 1); await cancelOrder(db, c); // cancelado
    await createOrder(db, { ...who, items: [{ variantId: v, qty: 1 }] }); // pendiente
    const s = await getSummary(db, wide);
    expect(s).toEqual({ sales: 200000, orders: 1, avgTicket: 200000, pending: 1 });
  });

  it("getSummary sin pedidos devuelve ceros", async () => {
    const db = await makeTestDb();
    expect(await getSummary(db, wide)).toEqual({ sales: 0, orders: 0, avgTicket: 0, pending: 0 });
  });

  it("excluye pedidos confirmados fuera del rango; pending no depende del rango", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { price: 10000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    const inside = await sale(db, v, 1);
    const outside = await sale(db, v, 3);
    await createOrder(db, { ...who, items: [{ variantId: v, qty: 1 }] });
    await db.update(orders).set({ confirmedAt: new Date("2026-03-10T15:00:00Z") }).where(eq(orders.id, inside));
    await db.update(orders).set({ confirmedAt: new Date("2026-02-01T15:00:00Z") }).where(eq(orders.id, outside));
    const r = resolveRange("custom", new Date("2026-03-12T12:00:00Z"), { from: "2026-03-10", to: "2026-03-10" });
    expect(await getSummary(db, r)).toEqual({ sales: 10000, orders: 1, avgTicket: 10000, pending: 1 });
    expect((await topProducts(db, r)).map((x) => x.units)).toEqual([1]);
    expect((await salesByDay(db, r)).reduce((a, x) => a + x.total, 0)).toBe(10000);
  });

  it("un pedido confirmado y luego cancelado se excluye de ventas, top y salesByDay", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { price: 10000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    const id = await sale(db, v, 2);
    await cancelOrder(db, id);
    expect((await getSummary(db, wide)).sales).toBe(0);
    expect(await topProducts(db, wide)).toEqual([]);
    expect((await salesByDay(db, resolveRange("7d", new Date()))).every((d) => d.total === 0 && d.orders === 0)).toBe(true);
  });

  it("salesByDay rellena días vacíos y agrupa en hora de Bogotá", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { price: 50000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    const id = await sale(db, v, 1);
    // 2026-03-10 02:00 UTC = 2026-03-09 21:00 Bogotá
    await db.update(orders).set({ confirmedAt: new Date("2026-03-10T02:00:00Z") }).where(eq(orders.id, id));
    const r = resolveRange("custom", new Date("2026-03-12T12:00:00Z"), { from: "2026-03-08", to: "2026-03-10" });
    const rows = await salesByDay(db, r);
    expect(rows).toEqual([
      { day: "2026-03-08", total: 0, orders: 0 },
      { day: "2026-03-09", total: 50000, orders: 1 },
      { day: "2026-03-10", total: 0, orders: 0 },
    ]);
  });

  it("topProducts ordena por unidades e ingreso", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { name: "A", price: 10000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    const b = await seedProduct(db, { name: "B", price: 90000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    await sale(db, a.variantIds[0], 5); await sale(db, b.variantIds[0], 1);
    const t = await topProducts(db, wide, 5);
    expect(t.map((x) => x.name)).toEqual(["A", "B"]);
    expect(t[0]).toEqual({ name: "A", units: 5, revenue: 50000 });
  });

  it("topProducts agrupa por nombre entre variantes y respeta limit", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { name: "A", price: 10000, variants: [{ size: "M", color: "Negro", stock: 20 }, { size: "L", color: "Negro", stock: 20 }] });
    const b = await seedProduct(db, { name: "B", price: 10000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    const c = await seedProduct(db, { name: "C", price: 10000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    await sale(db, a.variantIds[0], 2); await sale(db, a.variantIds[1], 2);
    await sale(db, b.variantIds[0], 3); await sale(db, c.variantIds[0], 1);
    const t = await topProducts(db, wide, 2);
    expect(t).toEqual([{ name: "A", units: 4, revenue: 40000 }, { name: "B", units: 3, revenue: 30000 }]);
  });

  it("lowStock excluye inactivos y respeta el umbral", async () => {
    const db = await makeTestDb();
    const { productId } = await seedProduct(db, { name: "Bajo", variants: [{ size: "M", color: "Negro", stock: 2 }, { size: "L", color: "Negro", stock: 9 }] });
    await seedProduct(db, { name: "Oculto", active: false, variants: [{ size: "M", color: "Negro", stock: 0 }] });
    const l = await lowStock(db, 3);
    expect(l.map((x) => `${x.name}/${x.size}`)).toEqual(["Bajo/M"]);
    expect(l[0].productId).toBe(productId);
  });

  it("resolveRange today usa día calendario de Bogotá", () => {
    const r = resolveRange("today", new Date("2026-03-10T03:00:00Z")); // 9 mar 22:00 Bogotá
    expect(r.from.toISOString()).toBe("2026-03-09T05:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-03-10T04:59:59.999Z");
  });

  it("resolveRange 7d, 30d y month tienen los límites esperados", () => {
    const now = new Date("2026-03-10T15:00:00Z"); // 10 mar 10:00 Bogotá
    const end = "2026-03-11T04:59:59.999Z";
    const r7 = resolveRange("7d", now);
    expect(r7.from.toISOString()).toBe("2026-03-04T05:00:00.000Z");
    expect(r7.to.toISOString()).toBe(end);
    const r30 = resolveRange("30d", now);
    expect(r30.from.toISOString()).toBe("2026-02-09T05:00:00.000Z");
    expect(r30.to.toISOString()).toBe(end);
    const m = resolveRange("month", now);
    expect(m.from.toISOString()).toBe("2026-03-01T05:00:00.000Z");
    expect(m.to.toISOString()).toBe(end);
  });

  it("resolveRange custom válido y fallback a 30d si es inválido", () => {
    const now = new Date("2026-03-10T15:00:00Z");
    const ok = resolveRange("custom", now, { from: "2026-03-01", to: "2026-03-03" });
    expect(ok.from.toISOString()).toBe("2026-03-01T05:00:00.000Z");
    expect(ok.to.toISOString()).toBe("2026-03-04T04:59:59.999Z");
    const d30 = resolveRange("30d", now);
    for (const c of [{ from: "x", to: "2026-03-03" }, { from: "2026-02-31", to: "2026-03-03" }, { from: "2026-03-05", to: "2026-03-03" }, undefined]) {
      expect(resolveRange("custom", now, c)).toEqual(d30);
    }
  });
});
