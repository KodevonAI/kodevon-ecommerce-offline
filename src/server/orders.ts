import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, orders, products, variants } from "@/db/schema";
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
