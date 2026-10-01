import { and, asc, between, count, desc, eq, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, orders, products, variants } from "@/db/schema";

export type Range = { from: Date; to: Date };
export type RangeKey = "today" | "7d" | "30d" | "month" | "custom";

const OFFSET_MS = 5 * 3600_000; // Bogotá = UTC-5, sin DST
const DAY_MS = 24 * 3600_000;

/** Medianoche (Bogotá) del día que contiene `d`, expresada en UTC. */
function startOfBogotaDay(d: Date): number {
  const local = d.getTime() - OFFSET_MS;
  return Math.floor(local / DAY_MS) * DAY_MS + OFFSET_MS;
}

function parseDay(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00.000-05:00`);
  if (Number.isNaN(t)) return null;
  // rechaza fechas desbordadas como 2026-02-31
  return new Date(t - OFFSET_MS).toISOString().slice(0, 10) === s ? t : null;
}

export function resolveRange(
  key: RangeKey,
  now: Date,
  custom?: { from: string; to: string },
): Range {
  const todayStart = startOfBogotaDay(now);
  const endOfToday = todayStart + DAY_MS - 1;
  switch (key) {
    case "today":
      return { from: new Date(todayStart), to: new Date(endOfToday) };
    case "7d":
      return { from: new Date(todayStart - 6 * DAY_MS), to: new Date(endOfToday) };
    case "month": {
      const local = new Date(now.getTime() - OFFSET_MS);
      const first = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + OFFSET_MS;
      return { from: new Date(first), to: new Date(endOfToday) };
    }
    case "custom": {
      const f = custom ? parseDay(custom.from) : null;
      const t = custom ? parseDay(custom.to) : null;
      if (f !== null && t !== null && f <= t) {
        // máximo 366 días (from..to inclusive): acota consultas y el relleno de salesByDay
        return { from: new Date(Math.max(f, t - 365 * DAY_MS)), to: new Date(t + DAY_MS - 1) };
      }
      return resolveRange("30d", now);
    }
    case "30d":
    default:
      return { from: new Date(todayStart - 29 * DAY_MS), to: new Date(endOfToday) };
  }
}

const confirmedIn = (r: Range) =>
  and(eq(orders.status, "confirmed"), between(orders.confirmedAt, r.from, r.to));

export async function getSummary(db: Db, r: Range) {
  const [row] = await db
    .select({
      sales: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
      orders: count(),
    })
    .from(orders)
    .where(confirmedIn(r));
  const [p] = await db.select({ n: count() }).from(orders).where(eq(orders.status, "pending"));
  const sales = Number(row.sales);
  const n = Number(row.orders);
  return { sales, orders: n, avgTicket: n ? Math.round(sales / n) : 0, pending: Number(p.n) };
}

export async function salesByDay(db: Db, r: Range) {
  const day = sql<string>`to_char(${orders.confirmedAt} at time zone 'America/Bogota', 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, total: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`, orders: count() })
    .from(orders)
    .where(confirmedIn(r))
    .groupBy(day);
  const byDay = new Map(rows.map((x) => [x.day, { total: Number(x.total), orders: Number(x.orders) }]));
  const out: { day: string; total: number; orders: number }[] = [];
  for (let t = startOfBogotaDay(r.from); t <= r.to.getTime(); t += DAY_MS) {
    const key = new Date(t - OFFSET_MS).toISOString().slice(0, 10);
    out.push({ day: key, ...(byDay.get(key) ?? { total: 0, orders: 0 }) });
  }
  return out;
}

export async function topProducts(db: Db, r: Range, limit = 5) {
  const units = sql<number>`sum(${orderItems.qty})::bigint`;
  const revenue = sql<number>`sum(${orderItems.qty} * ${orderItems.unitPrice})::bigint`;
  const rows = await db
    .select({ name: orderItems.productName, units, revenue })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(confirmedIn(r))
    .groupBy(orderItems.productName)
    .orderBy(desc(units), desc(revenue), asc(orderItems.productName))
    .limit(limit);
  return rows.map((x) => ({ name: x.name, units: Number(x.units), revenue: Number(x.revenue) }));
}

export async function lowStock(db: Db, threshold: number) {
  return db
    .select({
      variantId: variants.id,
      productId: products.id,
      name: products.name,
      size: variants.size,
      colorName: variants.colorName,
      stock: variants.stock,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(eq(products.active, true), lte(variants.stock, threshold)))
    .orderBy(asc(variants.stock), asc(products.name), asc(variants.size));
}
