import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, orders } from "@/db/schema";
import type { MsgLine } from "@/lib/whatsapp";

export type PublicOrder = {
  code: string;
  customerName: string;
  /** Solo los últimos 4 dígitos; el teléfono completo nunca sale de la BD hacia la página pública. */
  maskedPhone: string;
  status: "pending" | "confirmed" | "cancelled";
  total: number;
  lines: MsgLine[];
};

export const maskPhone = (phone: string): string => `••••••${phone.slice(-4)}`;

export const STATUS_LABEL: Record<PublicOrder["status"], string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

export async function getPublicOrder(db: Db, code: string): Promise<PublicOrder | null> {
  const [o] = await db.select().from(orders).where(eq(orders.code, code)).limit(1);
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id)).orderBy(asc(orderItems.id));
  return {
    code: o.code,
    customerName: o.customerName,
    maskedPhone: maskPhone(o.customerPhone),
    status: o.status,
    total: o.total,
    lines: items.map((i) => ({
      productName: i.productName, size: i.size, colorName: i.colorName, qty: i.qty, unitPrice: i.unitPrice,
    })),
  };
}
