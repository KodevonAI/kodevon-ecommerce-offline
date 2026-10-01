import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { settings } from "@/db/schema";

export async function getSettings(db: Db) {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  return { whatsappNumber: s.whatsappNumber, storeName: s.storeName, lowStockThreshold: s.lowStockThreshold };
}

/** La tienda solo puede recibir pedidos cuando hay un número de WhatsApp configurado. */
export const isStoreConfigured = (s: { whatsappNumber: string }): boolean => s.whatsappNumber.trim() !== "";
