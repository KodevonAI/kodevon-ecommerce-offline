import { describe, it, expect, beforeAll } from "vitest";
import type { Db } from "@/db/client";
import { createOrder } from "@/server/orders";
import { getPublicOrder, maskPhone } from "@/server/orders-public";
import { makeTestDb, seedProduct } from "../helpers/db";

describe("orders-public", () => {
  let db: Db;
  beforeAll(async () => { db = await makeTestDb(); });

  it("maskPhone deja solo los últimos 4 dígitos", () => {
    expect(maskPhone("3001234567")).toBe("••••••4567");
  });

  it("devuelve null si el código no existe", async () => {
    expect(await getPublicOrder(db, "OFF-9999")).toBeNull();
  });

  it("devuelve el pedido con el snapshot de líneas y teléfono enmascarado", async () => {
    const { variantIds } = await seedProduct(db, { name: "Buzo Test", price: 100000, salePrice: 80000, variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const r = await createOrder(db, { name: "Ana", phone: "3001234567", items: [{ variantId: variantIds[0], qty: 2 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const o = await getPublicOrder(db, r.data.code);
    expect(o).toEqual({
      code: r.data.code, customerName: "Ana", maskedPhone: "••••••4567", status: "pending", total: 160000,
      lines: [{ productName: "Buzo Test", size: "M", colorName: "Negro", qty: 2, unitPrice: 80000 }],
    });
    expect(JSON.stringify(o)).not.toContain("3001234567");
  });
});
