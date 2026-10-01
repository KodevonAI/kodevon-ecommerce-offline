// DEMO SOLO PARA DESARROLLO: catálogo en memoria para ver la tienda sin base de datos.
// Se activa con DEMO_MODE=1 y NODE_ENV !== "production" (ver isDemoMode en cached.ts).
// Archivo autocontenido: para quitar la demo, borrar este archivo y las ramas `isDemoMode()` de cached.ts.
import type { CartLine, CatalogFilters, ProductCard, getProductBySlug } from "./catalog";
import type { PublicOrder } from "./orders-public";

type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;
type DemoVariant = ProductDetail["variants"][number];

const COLORS = {
  Negro: "#151515",
  Hueso: "#e9e5da",
  Blanco: "#f6f6f2",
  Gris: "#8a8a85",
  Carbón: "#3a3a38",
  Oliva: "#5b5e4a",
  Arena: "#cbbf9f",
} as const;
type ColorName = keyof typeof COLORS;

const CATEGORIES = [
  { slug: "camisetas", name: "Camisetas" },
  { slug: "buzos", name: "Buzos" },
  { slug: "pantalones", name: "Pantalones" },
];

type Seed = {
  slug: string; name: string; category: string; price: number; salePrice?: number;
  description: string; colors: ColorName[]; sizes: string[];
  /** stock por talla (mismo para todos los colores) o función. */
  stock: (size: string, color: ColorName) => number;
};

const SEEDS: Seed[] = [
  {
    slug: "camiseta-pausa", name: "Camiseta Pausa", category: "camisetas", price: 89000,
    description: "Algodón peinado de 220 g, corte recto y cuello acanalado. Hecha para durar más que la batería del teléfono.",
    colors: ["Negro", "Hueso"], sizes: ["XL", "L", "M", "S"], stock: () => 12,
  },
  {
    slug: "camiseta-modo-avion", name: "Camiseta Modo Avión", category: "camisetas", price: 95000, salePrice: 69000,
    description: "Oversize de hombro caído con estampado frontal en tinta al agua. Lavada para que se sienta usada desde el primer día.",
    colors: ["Blanco", "Gris"], sizes: ["S", "M", "L"], stock: (s) => (s === "L" ? 3 : 8),
  },
  {
    slug: "camiseta-sin-senal", name: "Camiseta Sin Señal", category: "camisetas", price: 89000,
    description: "Tejido pesado, costuras dobles y una etiqueta que no pica. Pocas unidades de esta tanda.",
    colors: ["Negro"], sizes: ["S", "M", "L"], stock: (s) => (s === "M" ? 2 : s === "S" ? 0 : 1),
  },
  {
    slug: "camiseta-fuera-de-linea", name: "Camiseta Fuera de Línea", category: "camisetas", price: 99000,
    description: "La primera edición. Se agotó en una tarde; avísanos por WhatsApp si quieres que vuelva.",
    colors: ["Hueso", "Negro"], sizes: ["S", "M", "L"], stock: () => 0,
  },
  {
    slug: "buzo-desconexion", name: "Buzo Desconexión", category: "buzos", price: 219000,
    description: "Felpa perchada de 380 g, capucha doble y bolsillo canguro. Para las noches sin pantalla.",
    colors: ["Negro", "Carbón"], sizes: ["M", "S", "XL", "L"], stock: (s, c) => (c === "Carbón" && s === "XL" ? 0 : 6),
  },
  {
    slug: "buzo-hora-local", name: "Buzo Hora Local", category: "buzos", price: 239000, salePrice: 189000,
    description: "Cuello redondo, puños anchos y bordado tono sobre tono en el pecho.",
    colors: ["Hueso", "Oliva"], sizes: ["S", "M", "L", "XL"], stock: (s) => (s === "S" ? 1 : 5),
  },
  {
    slug: "buzo-tiempo-libre", name: "Buzo Tiempo Libre", category: "buzos", price: 199000,
    description: "Media cremallera, tela francesa y un fit relajado que no se deforma.",
    colors: ["Gris"], sizes: ["M", "L", "XL"], stock: () => 9,
  },
  {
    slug: "pantalon-ruta-lenta", name: "Pantalón Ruta Lenta", category: "pantalones", price: 179000,
    description: "Drill de algodón, pierna recta y pretina con cordón interno. Para caminar sin afán.",
    colors: ["Negro", "Arena"], sizes: ["34", "28", "32", "30"], stock: (s) => (s === "28" ? 2 : 7),
  },
  {
    slug: "pantalon-cargo-pausa", name: "Pantalón Cargo Pausa", category: "pantalones", price: 209000,
    description: "Ripstop liviano con seis bolsillos y bota ajustable. Cabe todo menos el estrés.",
    colors: ["Oliva", "Negro"], sizes: ["30", "32", "34", "36"], stock: () => 4,
  },
];

type DemoProduct = Omit<ProductDetail, "siblings"> & { categorySlug: string; createdAt: number; modelId: string };

let nextVariantId = 1;
let nextProductId = 1;
// Cada combinación (semilla x color) es un producto con su propio slug.
const PRODUCTS: DemoProduct[] = SEEDS.flatMap((s, i) =>
  s.colors.map((color) => {
    const variants: DemoVariant[] = s.sizes.map((size) => ({ id: nextVariantId++, size, stock: s.stock(size, color) }));
    // Igual que la consulta real: tallas en orden alfabético (la UI ordena con sortSizes).
    variants.sort((a, b) => a.size.localeCompare(b.size));
    return {
      id: nextProductId++,
      slug: `${s.slug}-${color.toLowerCase()}`,
      name: s.name,
      description: s.description,
      price: s.price,
      salePrice: s.salePrice ?? null,
      categoryName: CATEGORIES.find((c) => c.slug === s.category)?.name ?? null,
      categorySlug: s.category,
      colorName: color as string,
      colorHex: COLORS[color] as string,
      modelId: s.slug,
      images: [],
      variants,
      createdAt: SEEDS.length - i, // el primer modelo es el más nuevo
    };
  }),
);

const inStock = (p: DemoProduct) => p.variants.some((v) => v.stock > 0);
const effective = (p: DemoProduct) => p.salePrice ?? p.price;
const toCard = (p: DemoProduct): ProductCard => ({
  id: p.id, slug: p.slug, name: p.name, price: p.price, salePrice: p.salePrice,
  image: p.images[0] ?? null, inStock: inStock(p), colorName: p.colorName, colorHex: p.colorHex,
  colors: PRODUCTS.filter((o) => o.modelId === p.modelId && o.id !== p.id)
    .map((o) => ({ slug: o.slug, colorName: o.colorName, colorHex: o.colorHex })),
});

export function demoListProducts(f: CatalogFilters): ProductCard[] {
  const q = f.q?.trim().toLowerCase();
  const rows = PRODUCTS.filter((p) =>
    (!f.category || p.categorySlug === f.category) &&
    (!f.size || p.variants.some((v) => v.size === f.size && v.stock > 0)) &&
    (!f.color || p.colorName === f.color) &&
    (typeof f.min !== "number" || effective(p) >= f.min) &&
    (typeof f.max !== "number" || effective(p) <= f.max) &&
    (!f.sale || p.salePrice !== null) &&
    (!q || p.name.toLowerCase().includes(q)),
  );
  rows.sort((a, b) =>
    f.sort === "price_asc" ? effective(a) - effective(b) || b.createdAt - a.createdAt || a.id - b.id
    : f.sort === "price_desc" ? effective(b) - effective(a) || b.createdAt - a.createdAt || a.id - b.id
    : b.createdAt - a.createdAt || a.id - b.id,
  );
  return rows.map(toCard);
}

export function demoProductBySlug(slug: string): ProductDetail | null {
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { categorySlug, createdAt, modelId, ...detail } = p;
  return {
    ...detail,
    siblings: PRODUCTS.filter((o) => o.modelId === modelId)
      .map((o) => ({ slug: o.slug, colorName: o.colorName, colorHex: o.colorHex, inStock: inStock(o) })),
  };
}

export function demoFilterOptions() {
  const sizes = [...new Set(PRODUCTS.flatMap((p) => p.variants.map((v) => v.size)))].sort();
  const colorMap = new Map<string, string>();
  for (const p of PRODUCTS) if (!colorMap.has(p.colorName)) colorMap.set(p.colorName, p.colorHex);
  const colors = [...colorMap].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name));
  return { categories: CATEGORIES, sizes, colors };
}

export const DEMO_SETTINGS = { whatsappNumber: "3000000000", storeName: "OFFLINE", lowStockThreshold: 3 };

/** Líneas de carrito para ids de variante (misma forma que getCartLines). Los ids desconocidos se omiten. */
export function demoCartLines(ids: number[]): CartLine[] {
  const want = new Set(ids);
  const out: CartLine[] = [];
  for (const p of PRODUCTS) {
    for (const v of p.variants) {
      if (!want.has(v.id)) continue;
      out.push({
        variantId: v.id, productName: p.name, slug: p.slug, size: v.size, colorName: p.colorName,
        price: effective(p), stock: v.stock, image: p.images[0] ?? null, active: true,
      });
    }
  }
  return out;
}

/** Pedido fijo para /pedido/OFF-DEMO (no se guarda nada). */
export function demoOrder(): PublicOrder {
  const p = PRODUCTS[0];
  const q = PRODUCTS.find((x) => x.slug === "camiseta-modo-avion-blanco") ?? PRODUCTS[1];
  const lines = [
    { productName: p.name, size: "M", colorName: p.colorName, qty: 2, unitPrice: effective(p) },
    { productName: q.name, size: "S", colorName: q.colorName, qty: 1, unitPrice: effective(q) },
  ];
  return {
    code: "OFF-DEMO", status: "pending",
    total: lines.reduce((t, l) => t + l.unitPrice * l.qty, 0), lines,
  };
}
