import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, orders } from "@/db/schema";
import type { MsgLine } from "@/lib/whatsapp";

export type PublicOrder = {
  code: string;
  status: "pending" | "confirmed" | "cancelled";
  total: number;
  lines: MsgLine[];
};

export const STATUS_LABEL: Record<PublicOrder["status"], string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

export async function getPublicOrder(db: Db, code: string): Promise<PublicOrder | null> {
  // Página pública sin auth: proyección explícita, nunca nombre ni teléfono.
  const [o] = await db.select({ id: orders.id, code: orders.code, status: orders.status, total: orders.total }).from(orders).where(eq(orders.code, code)).limit(1);
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id)).orderBy(asc(orderItems.id));
  return {
    code: o.code,
    status: o.status,
    total: o.total,
    lines: items.map((i) => ({
      productName: i.productName, size: i.size, colorName: i.colorName, qty: i.qty, unitPrice: i.unitPrice,
    })),
  };
}
