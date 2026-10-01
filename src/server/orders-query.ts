import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, orders, variants } from "@/db/schema";
import { escapeLike } from "@/lib/like";

export const ORDERS_PAGE_SIZE = 20;

export type OrderFilters = {
  status?: "pending" | "confirmed" | "cancelled";
  from?: Date;
  to?: Date;
  q?: string;
  page?: number;
};

export type OrderRow = {
  id: number; code: string; customerName: string; customerPhone: string;
  status: string; total: number; createdAt: Date;
};

export async function listOrders(db: Db, f: OrderFilters): Promise<{ rows: OrderRow[]; total: number }> {
  const conds: (SQL | undefined)[] = [];
  if (f.status) conds.push(eq(orders.status, f.status));
  if (f.from) conds.push(gte(orders.createdAt, f.from));
  if (f.to) conds.push(lte(orders.createdAt, f.to));
  const q = f.q?.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    conds.push(or(ilike(orders.code, like), ilike(orders.customerName, like), ilike(orders.customerPhone, like)));
  }
  const where = conds.length ? and(...conds) : undefined;
  const page = Number.isInteger(f.page) && f.page! >= 1 ? f.page! : 1;

  const rows = await db
    .select({
      id: orders.id, code: orders.code, customerName: orders.customerName,
      customerPhone: orders.customerPhone, status: orders.status, total: orders.total, createdAt: orders.createdAt,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(ORDERS_PAGE_SIZE)
    .offset((page - 1) * ORDERS_PAGE_SIZE);
  const [{ n }] = await db.select({ n: count() }).from(orders).where(where);
  return { rows, total: Number(n) };
}

export async function getOrderDetail(db: Db, id: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return null;
  const items = await db
    .select({
      id: orderItems.id, orderId: orderItems.orderId, variantId: orderItems.variantId,
      productName: orderItems.productName, size: orderItems.size, colorName: orderItems.colorName,
      unitPrice: orderItems.unitPrice, qty: orderItems.qty,
      currentStock: sql<number | null>`${variants.stock}`,
    })
    .from(orderItems)
    .leftJoin(variants, eq(orderItems.variantId, variants.id))
    .where(eq(orderItems.orderId, id))
    .orderBy(orderItems.id);
  return { order, items };
}
