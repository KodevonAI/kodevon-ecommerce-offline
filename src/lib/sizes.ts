export const SIZE_SUGGESTIONS = ["XS", "S", "M", "L", "XL", "XXL"];

const LETTER_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

/** Orden canónico: tallas de letra, luego numéricas ascendentes, luego el resto alfabético. */
export function sortSizes(sizes: string[]): string[] {
  const rank = (s: string): [number, number, string] => {
    const t = s.trim().toUpperCase();
    const li = LETTER_ORDER.indexOf(t);
    if (li >= 0) return [0, li, t];
    if (/^\d+(\.\d+)?$/.test(t)) return [1, Number(t), t];
    return [2, 0, t];
  };
  return [...sizes].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2].localeCompare(rb[2], "es");
  });
}
