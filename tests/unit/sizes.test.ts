import { describe, it, expect } from "vitest";
import { sortSizes, SIZE_SUGGESTIONS } from "@/lib/sizes";

describe("sortSizes", () => {
  it("ordena letras canónicamente", () => {
    expect(sortSizes(["XL", "S", "XXL", "M", "XS", "L"])).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
    expect(sortSizes(["XXXL", "XXL"])).toEqual(["XXL", "XXXL"]);
  });
  it("letras, luego numéricas ascendentes, luego otras alfabéticas", () => {
    expect(sortSizes(["Única", "32", "M", "28", "30", "Bebé", "S", "100"]))
      .toEqual(["S", "M", "28", "30", "32", "100", "Bebé", "Única"]);
  });
  it("no muta la entrada y expone sugerencias", () => {
    const input = ["L", "S"];
    sortSizes(input);
    expect(input).toEqual(["L", "S"]);
    expect(SIZE_SUGGESTIONS).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
  });
});
