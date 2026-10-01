export type ItemIssue = { variantId: number; reason: "not_found" | "inactive" | "insufficient"; available: number };
export type OrderError =
  | { code: "invalid_items"; issues: ItemIssue[] }
  | { code: "invalid_state" }
  | { code: "not_found" }
  | { code: "variant_missing" }
  | { code: "insufficient_stock"; lines: { variantId: number; name: string; needed: number; available: number }[] };
export type Result<T> = { ok: true; data: T } | { ok: false; error: OrderError };
