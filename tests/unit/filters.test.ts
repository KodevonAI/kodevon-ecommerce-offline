import { describe, it, expect } from "vitest";
import { parseFilters } from "@/lib/filters";

describe("parseFilters", () => {
  it("arrays toman el primer valor y se recorta el espacio", () => {
    expect(parseFilters({ q: ["  hola ", "x"], category: " camisetas " })).toMatchObject({ q: "hola", category: "camisetas" });
  });
  it("min/max ignoran NaN, negativos, enormes y vacíos", () => {
    const f = parseFilters({ min: "abc", max: "-5" });
    expect(f.min).toBeUndefined();
    expect(f.max).toBeUndefined();
    expect(parseFilters({ min: "1e12", max: "9999999999" })).toMatchObject({ min: undefined, max: undefined });
    expect(parseFilters({ min: "   ", max: "Infinity" })).toMatchObject({ min: undefined, max: undefined });
  });
  it("min/max válidos se truncan a entero", () => {
    expect(parseFilters({ min: " 100.9 ", max: "1000000000" })).toMatchObject({ min: 100, max: 1_000_000_000 });
    expect(parseFilters({ min: "0" }).min).toBe(0);
  });
  it("sort desconocido se ignora", () => {
    expect(parseFilters({ sort: "hack" }).sort).toBeUndefined();
    expect(parseFilters({ sort: "price_asc" }).sort).toBe("price_asc");
  });
  it("valida category/size/color contra las opciones", () => {
    const options = { categories: [{ slug: "camisetas" }], sizes: ["M"], colors: [{ name: "Negro" }] };
    const f = parseFilters({ category: "nada", size: "XXL", color: "Rosa" }, options);
    expect(f.category).toBeUndefined();
    expect(f.size).toBeUndefined();
    expect(f.color).toBeUndefined();
    expect(parseFilters({ category: "camisetas", size: "M", color: "Negro" }, options)).toMatchObject({ category: "camisetas", size: "M", color: "Negro" });
  });
});
