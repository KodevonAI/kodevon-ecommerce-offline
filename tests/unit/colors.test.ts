import { describe, it, expect } from "vitest";
import { PALETTE, isHexColor, nearestColorName } from "@/lib/colors";

describe("colors", () => {
  it("cada color de la paleta se nombra a sí mismo", () => {
    for (const c of PALETTE) expect(nearestColorName(c.hex)).toBe(c.name);
  });
  it("no distingue mayúsculas y reconoce negro/blanco cercanos", () => {
    expect(nearestColorName("#FFFFFF")).toBe("Blanco");
    expect(nearestColorName("#0a0a0a")).toBe("Negro");
    expect(nearestColorName("#fafafa")).toBe("Blanco");
  });
  it("hex inválido lanza", () => {
    expect(() => nearestColorName("rojo")).toThrow();
    expect(() => nearestColorName("#fff")).toThrow();
  });
  it("isHexColor", () => {
    expect(isHexColor("#a1B2c3")).toBe(true);
    for (const bad of ["red", "#fff", "#GGGGGG", "a1b2c3", "#a1b2c34", ""]) expect(isHexColor(bad)).toBe(false);
  });
  it("la paleta no tiene nombres ni hex repetidos", () => {
    expect(new Set(PALETTE.map((c) => c.name)).size).toBe(PALETTE.length);
    expect(new Set(PALETTE.map((c) => c.hex.toLowerCase())).size).toBe(PALETTE.length);
  });
});
