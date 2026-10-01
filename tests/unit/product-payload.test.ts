import { describe, it, expect } from "vitest";
import { mapSaveError, parseProductPayload } from "@/lib/product-payload";

const valid = {
  name: "Camiseta", description: "", categoryId: null, price: 50000, salePrice: null, active: true,
  colorName: "Negro", colorHex: "#000000", images: [], variants: [{ size: "M", stock: 2 }],
};

describe("parseProductPayload", () => {
  it("acepta un payload válido", () => {
    const r = parseProductPayload(JSON.stringify(valid));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.variants).toEqual([{ size: "M", stock: 2 }]);
  });
  it("JSON inválido o vacío → Datos inválidos", () => {
    expect(parseProductPayload("{no json")).toEqual({ ok: false, error: "Datos inválidos" });
    expect(parseProductPayload("")).toEqual({ ok: false, error: "Datos inválidos" });
  });
  it("falla de zod → primer mensaje", () => {
    expect(parseProductPayload(JSON.stringify({ ...valid, variants: [] }))).toEqual({ ok: false, error: "Agrega al menos una talla" });
    expect(parseProductPayload(JSON.stringify({ ...valid, colorName: "  " }))).toEqual({ ok: false, error: "Ponle nombre al color" });
    expect(parseProductPayload(JSON.stringify({ ...valid, salePrice: 60000 }))).toEqual({ ok: false, error: "La oferta debe ser menor al precio" });
    expect(parseProductPayload(JSON.stringify({ ...valid, images: ["https://evil.com/x.png"] }))).toEqual({ ok: false, error: "Foto inválida" });
  });
  it("null o tipos incorrectos → error, nunca lanza", () => {
    const r = parseProductPayload("null");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});

describe("mapSaveError", () => {
  it("errores de talla muestran su propio mensaje", () => {
    expect(mapSaveError(new Error("Talla duplicada"))).toBe("Talla duplicada");
    expect(mapSaveError(new Error("Talla vacía"))).toBe("Talla vacía");
  });
  it("violación de unicidad (23505) directa o en cause", () => {
    const msg = "No se pudo guardar el producto. Inténtalo de nuevo.";
    expect(mapSaveError(Object.assign(new Error("dup"), { code: "23505" }))).toBe(msg);
    expect(mapSaveError(new Error("Failed query", { cause: Object.assign(new Error("dup"), { code: "23505" }) }))).toBe(msg);
  });
  it("cualquier otra cosa → mensaje genérico (sin filtrar el detalle)", () => {
    const generic = "No se pudo guardar el producto";
    expect(mapSaveError(new Error("connection refused at 10.0.0.1"))).toBe(generic);
    expect(mapSaveError(new Error("Tallas: algo raro"))).toBe(generic);
    expect(mapSaveError("x")).toBe(generic);
    expect(mapSaveError(null)).toBe(generic);
  });
});
