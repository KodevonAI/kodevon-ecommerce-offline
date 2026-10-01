"use server";

import { getDb } from "@/db/client";
import { getCartLines, redactInactiveLines, type CartLine } from "@/server/catalog";
import { isDemoMode } from "@/server/cached";

export async function fetchCartLines(ids: number[]): Promise<CartLine[]> {
  if (!Array.isArray(ids) || ids.length > 50 || !ids.every((i) => Number.isInteger(i) && i > 0)) return [];
  if (ids.length === 0) return [];
  if (isDemoMode()) return redactInactiveLines(await (await import("@/server/demo-data")).demoCartLines(ids));
  return redactInactiveLines(await getCartLines(getDb(), ids));
}
