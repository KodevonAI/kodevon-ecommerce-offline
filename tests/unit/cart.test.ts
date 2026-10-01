import { describe, it, expect } from "vitest";
import { addItem, setQty, removeItem, parseStored } from "@/lib/cart";

describe("cart", () => {
  it("addItem suma la misma variante y topa en stock y en 20", () => {
    let c = addItem([], { variantId: 1, qty: 2 }, 3);
    c = addItem(c, { variantId: 1, qty: 5 }, 3);
    expect(c).toEqual([{ variantId: 1, qty: 3 }]);
    expect(addItem([], { variantId: 2, qty: 99 }, 100)).toEqual([{ variantId: 2, qty: 20 }]);
  });
  it("setQty<=0 elimina; topa en stock", () => {
    expect(setQty([{ variantId: 1, qty: 2 }], 1, 0, 5)).toEqual([]);
    expect(setQty([{ variantId: 1, qty: 2 }], 1, 9, 4)).toEqual([{ variantId: 1, qty: 4 }]);
  });
  it("removeItem", () => expect(removeItem([{ variantId: 1, qty: 1 }, { variantId: 2, qty: 1 }], 1)).toEqual([{ variantId: 2, qty: 1 }]));
  it("parseStored tolera basura", () => {
    expect(parseStored(null)).toEqual([]);
    expect(parseStored("{no json")).toEqual([]);
    expect(parseStored('[{"variantId":1,"qty":2},{"variantId":"x","qty":-1},null]')).toEqual([{ variantId: 1, qty: 2 }]);
  });
  it("parseStored topa qty en 20 y fusiona duplicados", () => {
    expect(parseStored('[{"variantId":1,"qty":99}]')).toEqual([{ variantId: 1, qty: 20 }]);
    expect(parseStored('[{"variantId":1,"qty":2},{"variantId":2,"qty":1},{"variantId":1,"qty":3}]')).toEqual([
      { variantId: 1, qty: 5 },
      { variantId: 2, qty: 1 },
    ]);
    expect(parseStored('[{"variantId":1,"qty":15},{"variantId":1,"qty":15}]')).toEqual([{ variantId: 1, qty: 20 }]);
  });
  it("parseStored descarta no-arrays, qty <= 0 y no enteros", () => {
    expect(parseStored('{"variantId":1,"qty":1}')).toEqual([]);
    expect(parseStored('[{"variantId":1,"qty":0},{"variantId":2,"qty":-3},{"variantId":3,"qty":1.5},{"variantId":0,"qty":1}]')).toEqual([]);
  });
  it("topa en 50 líneas distintas", () => {
    const fifty = Array.from({ length: 50 }, (_, i) => ({ variantId: i + 1, qty: 1 }));
    expect(addItem(fifty, { variantId: 999, qty: 1 }, 5)).toEqual(fifty);
    expect(addItem(fifty, { variantId: 7, qty: 1 }, 5)).toHaveLength(50);
    const raw = JSON.stringify(Array.from({ length: 60 }, (_, i) => ({ variantId: i + 1, qty: 1 })));
    const parsed = parseStored(raw);
    expect(parsed).toHaveLength(50);
    expect(parsed[49].variantId).toBe(50);
  });
});
