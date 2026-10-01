"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDb, type Db } from "@/db/client";
import { requireAdmin } from "@/server/auth";
import { cancelOrder, confirmOrder } from "@/server/orders";
import type { OrderError, Result } from "@/server/types";

const MSG = {
  invalid_state: "El pedido ya no está en un estado válido para esta acción",
  not_found: "Pedido no encontrado",
  variant_missing: "Un producto del pedido fue eliminado; no se puede confirmar",
  invalid_items: "El pedido tiene ítems inválidos",
} as const;

function humanize(e: OrderError): string {
  if (e.code === "insufficient_stock") {
    return "Stock insuficiente: " + e.lines.map((l) => `${l.name} (pide ${l.needed}, hay ${l.available})`).join("; ");
  }
  return MSG[e.code] ?? "No se pudo completar la acción";
}

type ActionResult = { ok: string } | { error: string };

async function run(id: number, fn: (db: Db, id: number) => Promise<Result<unknown>>): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0) return { error: MSG.not_found };
  const r = await fn(getDb(), id);
  revalidateTag("catalog");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin");
  return r.ok ? { ok: "Listo" } : { error: humanize(r.error) };
}

export async function confirmOrderAction(id: number): Promise<ActionResult> {
  return run(id, confirmOrder);
}
export async function cancelOrderAction(id: number): Promise<ActionResult> {
  return run(id, cancelOrder);
}
