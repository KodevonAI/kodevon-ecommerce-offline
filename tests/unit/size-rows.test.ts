import { describe, it, expect } from "vitest";
import { rowForAddedSize } from "@/lib/size-rows";

describe("rowForAddedSize", () => {
  const saved = [{ size: "M", stock: 7, variantId: 11 }];
  it("talla quitada sin guardar: recupera la fila guardada", () => {
    expect(rowForAddedSize("M", saved)).toEqual({ size: "M", stock: 7, variantId: 11 });
  });
  it("talla quitada y guardada (ya no está en el servidor): fila nueva con stock 0", () => {
    expect(rowForAddedSize("M", [])).toEqual({ size: "M", stock: 0 });
    expect(rowForAddedSize("M", [{ size: "L", stock: 1, variantId: 12 }])).toEqual({ size: "M", stock: 0 });
  });
  it("talla nunca guardada: fila nueva", () => {
    expect(rowForAddedSize("XL", saved)).toEqual({ size: "XL", stock: 0 });
  });
});
