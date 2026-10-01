import { describe, it, expect, beforeAll } from "vitest";
import type { Db } from "@/db/client";
import { createOrder } from "@/server/orders";
import { getPublicOrder } from "@/server/orders-public";
import { makeTestDb, seedProduct } from "../helpers/db";

describe("orders-public", () => {
  let db: Db;
  beforeAll(async () => { db = await makeTestDb(); });

  it("devuelve null si el código no existe", async () => {
    expect(await getPublicOrder(db, "OFF-9999")).toBeNull();
  });

  it("devuelve solo código, estado, total y líneas (sin nombre ni teléfono)", async () => {
    const { variantIds } = await seedProduct(db, { name: "Buzo Test", price: 100000, salePrice: 80000, variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const r = await createOrder(db, { name: "Ana", phone: "3001234567", items: [{ variantId: variantIds[0], qty: 2 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const o = await getPublicOrder(db, r.data.code);
    expect(o).toEqual({
      code: r.data.code, status: "pending", total: 160000,
      lines: [{ productName: "Buzo Test", size: "M", colorName: "Negro", qty: 2, unitPrice: 80000 }],
    });
    expect(JSON.stringify(o)).not.toContain("Ana");
    expect(JSON.stringify(o)).not.toMatch(/\d{4}567|3001|•/);
  });
});
