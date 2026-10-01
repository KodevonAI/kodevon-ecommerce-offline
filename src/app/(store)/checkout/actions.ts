"use server";

import { revalidateTag } from "next/cache";
import { getDb } from "@/db/client";
import { checkoutSchema } from "@/lib/validators";
import { buildOrderMessage, buildWaUrl } from "@/lib/whatsapp";
import { clientIp } from "@/server/auth";
import { isDemoMode } from "@/server/cached";
import { createOrder } from "@/server/orders";
import { hit } from "@/server/ratelimit";
import { getSettings, isStoreConfigured } from "@/server/settings";
import type { ItemIssue } from "@/server/types";

export type PlaceOrderResult =
  | { ok: true; code: string; waUrl: string }
  | { ok: false; error: string; issues?: ItemIssue[] };

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (isDemoMode()) {
    // Demo (solo dev): no toca la BD. Imposible en producción por el guard de isDemoMode().
    const demo = await import("@/server/demo-data");
    const found = demo.demoCartLines(parsed.data.items.map((i) => i.variantId));
    const byId = new Map(found.map((l) => [l.variantId, l]));
    const lines = parsed.data.items.flatMap((i) => {
      const l = byId.get(i.variantId);
      return l ? [{ productName: l.productName, size: l.size, colorName: l.colorName, qty: i.qty, unitPrice: l.price }] : [];
    });
    if (lines.length === 0) return { ok: false, error: "El carrito está vacío" };
    const total = lines.reduce((t, l) => t + l.unitPrice * l.qty, 0);
    const text = buildOrderMessage({ code: "OFF-DEMO", name: parsed.data.name, lines, total });
    return { ok: true, code: "OFF-DEMO", waUrl: buildWaUrl(demo.DEMO_SETTINGS.whatsappNumber, text) };
  }

  const db = getDb();
  if (!(await hit(db, `order:${await clientIp()}`, 5, 10 * 60))) {
    return { ok: false, error: "Demasiados pedidos seguidos. Intenta en unos minutos." };
  }
  const s = await getSettings(db);
  if (!isStoreConfigured(s)) {
    return { ok: false, error: "La tienda aún no está configurada. Escríbenos por otro medio." };
  }
  const r = await createOrder(db, parsed.data);
  if (!r.ok) {
    if (r.error.code === "invalid_items") {
      return { ok: false, error: "Algunos productos cambiaron de disponibilidad", issues: r.error.issues };
    }
    return { ok: false, error: "No pudimos crear el pedido" };
  }
  const text = buildOrderMessage({ code: r.data.code, name: parsed.data.name, lines: r.data.lines, total: r.data.total });
  revalidateTag("orders");
  return { ok: true, code: r.data.code, waUrl: buildWaUrl(s.whatsappNumber, text) };
}
