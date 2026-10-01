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
});
