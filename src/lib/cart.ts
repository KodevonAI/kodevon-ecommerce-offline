import { MAX_QTY_PER_LINE } from "./validators";

export type CartItem = { variantId: number; qty: number };
const cap = (qty: number, maxStock: number) => Math.max(0, Math.min(Math.floor(qty), maxStock, MAX_QTY_PER_LINE));

export function addItem(items: CartItem[], item: CartItem, maxStock: number): CartItem[] {
  const cur = items.find((i) => i.variantId === item.variantId);
  const qty = cap((cur?.qty ?? 0) + item.qty, maxStock);
  if (qty <= 0) return items.filter((i) => i.variantId !== item.variantId);
  return cur
    ? items.map((i) => (i.variantId === item.variantId ? { ...i, qty } : i))
    : [...items, { variantId: item.variantId, qty }];
}

export function setQty(items: CartItem[], variantId: number, qty: number, maxStock: number): CartItem[] {
  const q = cap(qty, maxStock);
  return q <= 0
    ? items.filter((i) => i.variantId !== variantId)
    : items.map((i) => (i.variantId === variantId ? { ...i, qty: q } : i));
}

export const removeItem = (items: CartItem[], variantId: number): CartItem[] =>
  items.filter((i) => i.variantId !== variantId);

export function parseStored(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const merged = new Map<number, number>();
    for (const i of v) {
      if (
        Boolean(i) && typeof i === "object" &&
        Number.isInteger(i.variantId) && i.variantId > 0 && Number.isInteger(i.qty) && i.qty > 0
      ) {
        merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.qty);
      }
    }
    return [...merged].map(([variantId, qty]) => ({ variantId, qty: Math.min(qty, MAX_QTY_PER_LINE) }));
  } catch {
    return [];
  }
}
