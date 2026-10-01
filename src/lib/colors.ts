export type NamedColor = { name: string; hex: string };

/** Paleta curada en español. Cada hex debe ser distinto: el color más cercano a un hex de la paleta es él mismo. */
export const PALETTE: NamedColor[] = [
  { name: "Negro", hex: "#000000" }, { name: "Blanco", hex: "#ffffff" },
  { name: "Gris", hex: "#808080" }, { name: "Gris claro", hex: "#c8c8c8" }, { name: "Gris oscuro", hex: "#404040" },
  { name: "Rojo", hex: "#d32f2f" }, { name: "Vino", hex: "#7b1e3a" },
  { name: "Rosa", hex: "#f48fb1" }, { name: "Fucsia", hex: "#d81b60" },
  { name: "Naranja", hex: "#f57c00" }, { name: "Mostaza", hex: "#d4a017" }, { name: "Amarillo", hex: "#fbc02d" },
  { name: "Verde", hex: "#388e3c" }, { name: "Verde oliva", hex: "#6b7a2a" }, { name: "Verde militar", hex: "#4b5320" }, { name: "Verde menta", hex: "#98d8b0" },
  { name: "Azul", hex: "#1976d2" }, { name: "Azul marino", hex: "#14213d" }, { name: "Celeste", hex: "#81d4fa" }, { name: "Turquesa", hex: "#26a69a" },
  { name: "Morado", hex: "#7b1fa2" }, { name: "Lila", hex: "#b39ddb" },
  { name: "Beige", hex: "#d9c7a5" }, { name: "Crema", hex: "#f3ead3" }, { name: "Hueso", hex: "#e9e5da" },
  { name: "Café", hex: "#6d4c41" }, { name: "Camel", hex: "#b5835a" }, { name: "Terracota", hex: "#c0583f" },
];

export const isHexColor = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

const PALETTE_LAB = PALETTE.map((c) => ({ name: c.name, lab: rgbToLab(hexToRgb(c.hex)) }));

export function nearestColorName(hex: string): string {
  if (!isHexColor(hex)) throw new Error(`Color inválido: ${hex}`);
  const lab = rgbToLab(hexToRgb(hex));
  let best = PALETTE_LAB[0];
  let bestD = Infinity;
  for (const c of PALETTE_LAB) {
    const d = (c.lab[0] - lab[0]) ** 2 + (c.lab[1] - lab[1]) ** 2 + (c.lab[2] - lab[2]) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best.name;
}
