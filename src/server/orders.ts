import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, orders, products, stockMovements, variants } from "@/db/schema";
import type { MsgLine } from "@/lib/whatsapp";
import type { ItemIssue, Result } from "./types";

export type CreatedOrder = { orderId: number; code: string; total: number; lines: MsgLine[] };

export async function createOrder(
  db: Db,
  input: { name: string; phone: string; items: { variantId: number; qty: number }[] },
): Promise<Result<CreatedOrder>> {
  const merged = new Map<number, number>();
  for (const i of input.items) {
    if (!Number.isInteger(i.qty) || i.qty < 1 || i.qty > 1000) {
      return { ok: false, error: { code: "invalid_items", issues: [{ variantId: i.variantId, reason: "insufficient", available: 0 }] } };
    }
    merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.qty);
  }
  if (merged.size === 0) return { ok: false, error: { code: "invalid_items", issues: [] } };

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: variants.id, size: variants.size, colorName: variants.colorName, stock: variants.stock,
        name: products.name, price: products.price, salePrice: products.salePrice, active: products.active,
      })
      .from(variants)
      .innerJoin(products, eq(variants.productId, products.id))
      .where(inArray(variants.id, [...merged.keys()]));
    const byId = new Map(rows.map((r) => [r.id, r]));

    const issues: ItemIssue[] = [];
    for (const [variantId, qty] of merged) {
      const v = byId.get(variantId);
      if (!v) issues.push({ variantId, reason: "not_found", available: 0 });
      else if (!v.active) issues.push({ variantId, reason: "inactive", available: 0 });
      else if (qty > v.stock) issues.push({ variantId, reason: "insufficient", available: v.stock });
    }
    if (issues.length) return { ok: false as const, error: { code: "invalid_items" as const, issues } };

    const lines: MsgLine[] = [...merged].map(([variantId, qty]) => {
      const v = byId.get(variantId)!;
      return { productName: v.name, size: v.size, colorName: v.colorName, qty, unitPrice: v.salePrice ?? v.price };
    });
    const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

    const seq = await tx.execute(sql`select nextval('order_code_seq') as n`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = Number((seq as any).rows[0].n);
    const code = `OFF-${String(n).padStart(4, "0")}`;

    const [o] = await tx.insert(orders)
      .values({ code, customerName: input.name, customerPhone: input.phone, total })
      .returning({ id: orders.id });
    await tx.insert(orderItems).values(
      [...merged].map(([variantId, qty], idx) => ({
        orderId: o.id, variantId, productName: lines[idx].productName, size: lines[idx].size,
        colorName: lines[idx].colorName, unitPrice: lines[idx].unitPrice, qty,
      })),
    );
    return { ok: true as const, data: { orderId: o.id, code, total, lines } };
  });
}

export async function confirmOrder(db: Db, orderId: number): Promise<Result<{ code: string }>> {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) return { ok: false as const, error: { code: "not_found" as const } };
    if (o.status !== "pending") return { ok: false as const, error: { code: "invalid_state" as const } };

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    if (items.some((i) => i.variantId === null)) {
      return { ok: false as const, error: { code: "variant_missing" as const } };
    }
    const needed = new Map<number, number>();
    for (const i of items) needed.set(i.variantId!, (needed.get(i.variantId!) ?? 0) + i.qty);

    // bloqueo ordenado por id para evitar deadlocks entre confirmaciones concurrentes
    const locked = await tx
      .select({ id: variants.id, stock: variants.stock, size: variants.size, color: variants.colorName, name: products.name })
      .from(variants)
      .innerJoin(products, eq(variants.productId, products.id))
      .where(inArray(variants.id, [...needed.keys()]))
      .orderBy(asc(variants.id))
      .for("update", { of: variants });

    if (locked.length !== needed.size) return { ok: false as const, error: { code: "variant_missing" as const } };
    const short = locked
      .filter((v) => v.stock < needed.get(v.id)!)
      .map((v) => ({ variantId: v.id, name: `${v.name} ${v.color}/${v.size}`, needed: needed.get(v.id)!, available: v.stock }));
    if (short.length) return { ok: false as const, error: { code: "insufficient_stock" as const, lines: short } };

    for (const [variantId, qty] of needed) {
      await tx.update(variants).set({ stock: sql`${variants.stock} - ${qty}` }).where(eq(variants.id, variantId));
      await tx.insert(stockMovements).values({ variantId, delta: -qty, reason: "order_confirmed", orderId });
    }
    await tx.update(orders).set({ status: "confirmed", confirmedAt: new Date() }).where(eq(orders.id, orderId));
    return { ok: true as const, data: { code: o.code } };
  });
}

export async function cancelOrder(db: Db, orderId: number): Promise<Result<{ code: string; restocked: boolean }>> {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) return { ok: false as const, error: { code: "not_found" as const } };
    if (o.status === "cancelled") return { ok: false as const, error: { code: "invalid_state" as const } };

    let restocked = false;
    if (o.status === "confirmed") {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const back = new Map<number, number>();
      for (const i of items) if (i.variantId !== null) back.set(i.variantId, (back.get(i.variantId) ?? 0) + i.qty);
      const ids = [...back.keys()].sort((a, b) => a - b);
      // solo las variantes que siguen existiendo tras el bloqueo (una borrada en paralelo no debe dar error de FK)
      const locked = ids.length
        ? await tx.select({ id: variants.id }).from(variants).where(inArray(variants.id, ids)).orderBy(asc(variants.id)).for("update")
        : [];
      for (const { id: variantId } of locked) {
        const qty = back.get(variantId)!;
        await tx.update(variants).set({ stock: sql`${variants.stock} + ${qty}` }).where(eq(variants.id, variantId));
        await tx.insert(stockMovements).values({ variantId, delta: qty, reason: "order_cancelled", orderId });
      }
      restocked = locked.length > 0;
    }
    await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, orderId));
    return { ok: true as const, data: { code: o.code, restocked } };
  });
}

export async function adjustStock(db: Db, variantId: number, delta: number): Promise<Result<{ stock: number }>> {
  if (!Number.isInteger(delta) || delta === 0) return { ok: false, error: { code: "invalid_state" } };
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(variants).where(eq(variants.id, variantId)).for("update");
    if (!v) return { ok: false as const, error: { code: "not_found" as const } };
    const next = v.stock + delta;
    if (next < 0) {
      return { ok: false as const, error: { code: "insufficient_stock" as const, lines: [{ variantId, name: `${v.colorName}/${v.size}`, needed: -delta, available: v.stock }] } };
    }
    await tx.update(variants).set({ stock: next }).where(eq(variants.id, variantId));
    await tx.insert(stockMovements).values({ variantId, delta, reason: "manual", orderId: null });
    return { ok: true as const, data: { stock: next } };
  });
}
