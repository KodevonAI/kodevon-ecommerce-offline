import { describe, it, expect } from "vitest";
import { MAX_FAVORITES, parseFavorites, toggleFavorite } from "@/lib/favorites";
import { parseTheme } from "@/lib/theme";

describe("favoritos", () => {
  it("parsea con tolerancia: JSON roto, tipos raros y duplicados", () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites("no-json")).toEqual([]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
    expect(parseFavorites('["a", 3, "", "a", "b"]')).toEqual(["a", "b"]);
  });

  it("toggle agrega al inicio, quita y respeta el máximo", () => {
    expect(toggleFavorite(["a"], "b")).toEqual(["b", "a"]);
    expect(toggleFavorite(["b", "a"], "b")).toEqual(["a"]);
    const full = Array.from({ length: MAX_FAVORITES }, (_, i) => `s${i}`);
    const next = toggleFavorite(full, "nuevo");
    expect(next).toHaveLength(MAX_FAVORITES);
    expect(next[0]).toBe("nuevo");
  });
});

describe("tema", () => {
  it("solo acepta light o dark; lo demás sigue al sistema", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("pop")).toBeUndefined();
    expect(parseTheme(undefined)).toBeUndefined();
  });
});
