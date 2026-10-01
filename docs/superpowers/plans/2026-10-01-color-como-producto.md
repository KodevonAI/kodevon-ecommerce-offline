# Color como producto, carga completa y eliminación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada color sea un producto distinto (agrupados por `model_id`), que el administrador cargue un producto completo (datos, color con gotero, fotos, tallas y stock) de una sola vez, y que pueda eliminar (o archivar) productos.

**Architecture:** El color pasa de `variants` a `products` mediante una migración **solo aditiva** (expand/contract). La lógica nueva vive en `src/server/products.ts` (funciones puras que reciben `db`, probadas con PGlite). El formulario de admin es un único componente cliente (`ProductEditor`) que mantiene todo el estado y envía un `payload` JSON a una Server Action. La tienda enlaza los colores hermanos con círculos que navegan al otro producto.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM + `pg` (Neon), PGlite + Vitest, zod v4, `@vercel/blob`, Tailwind + shadcn/base-ui, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-color-como-producto-design.md`

## Global Constraints

- Interfaz y mensajes en **español**; precios COP enteros, formato `$89.900`.
- **Cada color es un producto.** Un producto tiene un solo `color_name` + `color_hex` (`^#[0-9a-fA-F]{6}$`). Las variantes son **talla + stock**; índice único `(product_id, size)`.
- **Migración solo aditiva** (no se elimina `variants.color_name/color_hex` ni el índice `variants_unique`; solo se les pone `DEFAULT ''` para que el código nuevo inserte sin ellas). Si algún producto tiene variantes de más de un color, la migración **falla con** `Divide estos productos por color antes de migrar: <nombres>` sin modificar nada.
- **Eliminar:** se borra de verdad solo un producto sin ningún `order_items` apuntando a sus variantes (incluye pedidos cancelados); si los tiene, solo se **archiva** (`active = false`) y reactiva.
- **Todo o nada:** crear/editar un producto (datos + fotos + variantes + movimientos de stock) ocurre en **una transacción**.
- Las URLs de fotos que llegan al guardar deben cumplir `^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/`.
- Subida de fotos: jpg/png/webp, **máx. 4 MB**, una petición por archivo; la ruta solo sube y devuelve la URL (no toca la base).
- Toda página, Server Action y route handler de admin llama a `requireAdmin()` / `readSession` por sí misma (el middleware no es frontera de autorización).
- Todo cambio de productos invalida el tag de caché `catalog` (`revalidateTag("catalog")`) y las rutas admin afectadas.
- El stock inicial se registra como `stock_movements` (`reason: "manual"`, `orderId: null`); el stock de variantes existentes **solo** se cambia con `adjustStock`.
- No tocar `.next` ni el puerto 3000 (el controlador mantiene un servidor de desarrollo allí con `DEMO_MODE=1`): para compilar usar `NEXT_DIST_DIR=.next-build`, y Playwright usa su propio servidor en :3200.
- Convenciones del repo: `npx` se ejecuta como `/usr/bin/env npx` si el hook altera los argumentos; no hay binario `timeout` en macOS (usar el parámetro de timeout de la herramienta); mensajes de commit terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Entradas que el spec implica y que ninguna prueba "feliz" cubre; cada una tiene su prueba en la tarea indicada:

1. Editar un producto y **quitar una talla que ya tiene pedidos** → la variante queda en stock 0 (con movimiento), no se borra; las demás tallas intactas (Task 3).
2. **Dos productos con el mismo nombre y color** → el segundo recibe slug con sufijo numérico, nunca un error de unicidad (Task 3).
3. **Eliminar un producto cuyo único pedido está cancelado** → `has_orders` (se archiva, no se borra), porque `order_items` conserva el historial (Task 3).
4. **URL de foto que no es de Blob** (`http://…`, `javascript:…`, otro dominio) o hex inválido (`red`, `#fff`, `#GGGGGG`) → rechazado por el validador, nada se guarda (Task 2).
5. **Archivados y ajenos fuera de los círculos de color:** un hermano archivado no aparece en `siblings`/`colors`, ni uno de otro `model_id` (Task 4).

---

## File Structure

```
src/db/schema.ts                          products: +colorName,+colorHex,+modelId,+índice; variants: defaults de color, +índice único (product,size)
src/db/migrations/0002_*.sql (+meta)      migración aditiva con chequeo previo
src/lib/colors.ts                         PALETTE, isHexColor, nearestColorName  (nuevo, puro)
src/lib/validators.ts                     productFullSchema, BLOB_URL
src/server/products.ts                    createProductFull, updateProductFull, deleteProduct, getProductEditData (reemplaza generateVariants/removeVariant/addImage/...)
src/server/catalog.ts                     colores en tarjetas, siblings, filtros, líneas de carrito
src/server/orders.ts, stats.ts            color desde products
src/server/demo-data.ts                   un producto por color, con model_id
src/app/api/admin/upload/route.ts         solo sube y devuelve { urls }
src/app/admin/productos/actions.ts        saveProductFull, deleteProductAction, toggleActive, setStockAction
src/app/admin/productos/{page,nuevo/page,[id]/page}.tsx
src/components/admin/ProductEditor.tsx    formulario único (cliente)
src/components/admin/ColorPicker.tsx      selector + gotero + nombre automático
src/components/admin/PhotoUploader.tsx    fotos antes de guardar
src/components/admin/SizeStockEditor.tsx  tallas + stock inicial / ajuste
src/components/admin/ProductActions.tsx   eliminar o archivar con diálogo
src/components/store/{VariantPicker,ProductCard}.tsx, app/(store)/producto/[slug]/page.tsx
tests/helpers/db.ts                       seedProduct con color por producto
tests/unit/{migration-0002,colors,products,catalog,orders.create,stats}.test.ts (+ ajustes)
tests/e2e/*                               actualizados
README.md                                 notas de la nueva carga y del despliegue
```

---

### Task 1: Esquema, migración 0002 y helper de pruebas

**Files:**
- Modify: `src/db/schema.ts`, `tests/helpers/db.ts`
- Create: `src/db/migrations/0002_*.sql` (+ `meta/` generado), `tests/unit/migration-0002.test.ts`

**Interfaces:**
- Produces: `products.colorName: string`, `products.colorHex: string`, `products.modelId: string` (todas NOT NULL); `variants` mantiene `colorName`/`colorHex` con default `''`/`'#000000'`. `seedProduct(db, o)` con `o.color?: string`, `o.colorHex?: string`, `o.modelId?: string`, `o.variants?: { size: string; color?: string; stock: number }[]` → `{ productId, variantIds, modelId }`. **Compatible hacia atrás** con las llamadas actuales (`variants: [{ size, color, stock }]`).

- [ ] **Step 1: Prueba de migración que falla**

`tests/unit/migration-0002.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

const dir = "src/db/migrations";
function statements(prefix: string): string[] {
  const f = readdirSync(dir).find((n) => n.startsWith(prefix) && n.endsWith(".sql"));
  if (!f) throw new Error(`No existe la migración ${prefix}*`);
  return readFileSync(`${dir}/${f}`, "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
}
async function run(c: PGlite, prefix: string) {
  for (const s of statements(prefix)) await c.exec(s);
}
async function legacyDb() {
  const c = new PGlite();
  await run(c, "0000_");
  await run(c, "0001_");
  return c;
}
async function addLegacyProduct(c: PGlite, name: string, variants: [string, string, string][]) {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const r = await c.query<{ id: number }>(`insert into products (name, slug, price) values ($1, $2, 50000) returning id`, [name, slug]);
  const id = r.rows[0].id;
  for (const [size, color, hex] of variants) {
    await c.query(`insert into variants (product_id, size, color_name, color_hex, stock) values ($1,$2,$3,$4,5)`, [id, size, color, hex]);
  }
  return id;
}

describe("migración 0002 (color en products)", () => {
  it("copia el color de las variantes al producto y arma el model_id", async () => {
    const c = await legacyDb();
    const id = await addLegacyProduct(c, "Blusa Basic", [["S", "Rojo", "#ff0000"], ["M", "Rojo", "#ff0000"]]);
    await run(c, "0002_");
    const r = await c.query<{ color_name: string; color_hex: string; model_id: string }>(
      `select color_name, color_hex, model_id from products where id = $1`, [id]);
    expect(r.rows[0]).toEqual({ color_name: "Rojo", color_hex: "#ff0000", model_id: `m-${id}` });
  });

  it("producto sin variantes queda con color vacío y model_id", async () => {
    const c = await legacyDb();
    const id = await addLegacyProduct(c, "Sin variantes", []);
    await run(c, "0002_");
    const r = await c.query<{ color_name: string; model_id: string }>(`select color_name, model_id from products where id = $1`, [id]);
    expect(r.rows[0]).toEqual({ color_name: "", model_id: `m-${id}` });
  });

  it("se detiene con un mensaje claro si un producto tiene dos colores y no modifica nada", async () => {
    const c = await legacyDb();
    await addLegacyProduct(c, "Blusa Basic", [["S", "Rojo", "#ff0000"], ["S", "Negro", "#000000"]]);
    await expect(run(c, "0002_")).rejects.toThrow(/Divide estos productos por color antes de migrar: Blusa Basic/);
    const cols = await c.query(`select 1 from information_schema.columns where table_name = 'products' and column_name = 'color_name'`);
    expect(cols.rows).toHaveLength(0);
  });

  it("permite insertar variantes sin color (default) y exige talla única por producto", async () => {
    const c = await legacyDb();
    const id = await addLegacyProduct(c, "Camiseta", [["M", "Negro", "#000000"]]);
    await run(c, "0002_");
    await c.query(`insert into variants (product_id, size, stock) values ($1, 'L', 3)`, [id]);
    await expect(c.query(`insert into variants (product_id, size, stock) values ($1, 'L', 1)`, [id])).rejects.toThrow();
  });
});
```
Run: `/usr/bin/env npx vitest run tests/unit/migration-0002.test.ts` → Expected: FAIL (`No existe la migración 0002_*`).

- [ ] **Step 2: Cambiar el esquema**

En `src/db/schema.ts`:
```ts
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id),
  price: integer("price").notNull(),
  salePrice: integer("sale_price"),
  active: boolean("active").notNull().default(true),
  colorName: text("color_name").notNull().default(""),
  colorHex: text("color_hex").notNull().default("#000000"),
  modelId: text("model_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("products_model_id_idx").on(t.modelId)]);
```
y en `variants`: `colorName: text("color_name").notNull().default("")` (comentario `// DEPRECADO: el color vive en products; se elimina en una migración posterior`), conservar `colorHex`, conservar el índice `variants_unique`, y añadir `uniqueIndex("variants_product_size_unique").on(t.productId, t.size)`.

- [ ] **Step 3: Generar y reemplazar el SQL**

Run: `npm run db:generate` (crea `0002_*.sql` y los `meta/` de snapshot/journal).
Sobrescribir el contenido del `0002_*.sql` generado (conservando su nombre y los `meta/` generados) con:
```sql
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.name, ', ') INTO bad FROM products p
  WHERE (SELECT count(DISTINCT v.color_name) FROM variants v WHERE v.product_id = p.id) > 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Divide estos productos por color antes de migrar: %', bad;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "color_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "color_hex" text DEFAULT '#000000' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "model_id" text;
--> statement-breakpoint
UPDATE "products" p SET "color_name" = v.color_name, "color_hex" = v.color_hex
FROM (SELECT DISTINCT ON (product_id) product_id, color_name, color_hex FROM variants ORDER BY product_id, id) v
WHERE v.product_id = p.id;
--> statement-breakpoint
UPDATE "products" SET "model_id" = 'm-' || "id";
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "model_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "variants" ALTER COLUMN "color_name" SET DEFAULT '';
--> statement-breakpoint
CREATE INDEX "products_model_id_idx" ON "products" USING btree ("model_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "variants_product_size_unique" ON "variants" USING btree ("product_id","size");
```
Comprobar que `meta/_journal.json` tiene la entrada `0002_*` y que `meta/0002_snapshot.json` refleja el esquema nuevo (incluye `model_id` NOT NULL y el índice).

- [ ] **Step 4: Actualizar `seedProduct`**

En `tests/helpers/db.ts` reemplazar `seedProduct` por:
```ts
export async function seedProduct(
  db: Db,
  o: {
    name?: string; price?: number; salePrice?: number | null; active?: boolean;
    color?: string; colorHex?: string; modelId?: string; images?: string[];
    variants?: { size: string; color?: string; stock: number }[];
  } = {},
) {
  const name = o.name ?? "Camiseta Oversize";
  const vs = o.variants ?? [{ size: "M", stock: 5 }];
  const color = o.color ?? vs.find((v) => v.color)?.color ?? "Negro";
  if (new Set(vs.map((v) => v.color ?? color)).size > 1) throw new Error("seedProduct: un producto tiene un solo color");
  const modelId = o.modelId ?? `m-${Math.random().toString(36).slice(2, 10)}`;
  const [p] = await db.insert(schema.products).values({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${color.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`,
    price: o.price ?? 89900,
    salePrice: o.salePrice ?? null,
    active: o.active ?? true,
    colorName: color,
    colorHex: o.colorHex ?? "#000000",
    modelId,
  }).returning();
  if (o.images?.length) {
    await db.insert(schema.productImages).values(o.images.map((url, position) => ({ productId: p.id, url, position })));
  }
  const rows = vs.length === 0 ? [] : await db.insert(schema.variants).values(
    vs.map((v) => ({ productId: p.id, size: v.size, stock: v.stock })),
  ).returning();
  return { productId: p.id, variantIds: rows.map((r) => r.id), modelId };
}
```

- [ ] **Step 5: Verificar**

Run: `/usr/bin/env npx vitest run` (suite completa, ~45 s).
Expected: `migration-0002` 4/4 PASS y **toda la suite previa sigue verde** (las pruebas existentes pasan `variants: [{ size, color, stock }]`, que `seedProduct` sigue aceptando). Si falla alguna prueba existente por el cambio de esquema/índice, corregir `seedProduct` o la prueba **sin debilitar aserciones**. `npx tsc --noEmit` limpio salvo los errores de tipos que el cambio de esquema provoque en archivos de las tareas siguientes (dejar anotados en el reporte los archivos afectados: `catalog.ts`, `orders.ts`, `stats.ts`, `demo-data.ts`, `products.ts`, páginas admin).

- [ ] **Step 6: Commit**
```bash
git add src/db tests/helpers/db.ts tests/unit/migration-0002.test.ts
git commit -m "feat(db): color en products, model_id y migración 0002 aditiva"
```

> Nota para el ejecutor: tras este commit `tsc` puede fallar hasta completar las Tasks 3–4 (el esquema cambió). Es esperado; la rama no se despliega entre tareas.

---

### Task 2: Colores y validación (puros)

**Files:**
- Create: `src/lib/colors.ts`, `tests/unit/colors.test.ts`
- Modify: `src/lib/validators.ts`, `tests/unit/lib.test.ts`

**Interfaces:**
- Produces:
  - `PALETTE: { name: string; hex: string }[]`
  - `isHexColor(s: string): boolean`
  - `nearestColorName(hex: string): string` (lanza `Error` si el hex es inválido)
  - `BLOB_URL: RegExp`
  - `productFullSchema` (zod) con tipo `ProductFullInput`:
    ```ts
    { name: string; description: string; categoryId: number | null; price: number; salePrice: number | null; active: boolean;
      colorName: string; colorHex: string; modelId?: string; images: string[];
      variants: { size: string; stock: number }[] }
    ```

- [ ] **Step 1: Pruebas que fallan**

`tests/unit/colors.test.ts`:
```ts
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
```
Añadir a `tests/unit/lib.test.ts`:
```ts
import { productFullSchema } from "@/lib/validators";

describe("productFullSchema", () => {
  const ok = {
    name: "Blusa Basic", description: "", categoryId: null, price: 50000, salePrice: null, active: true,
    colorName: "Rojo", colorHex: "#ff0000",
    images: ["https://abc123.public.blob.vercel-storage.com/products/1-foto.jpg"],
    variants: [{ size: "S", stock: 3 }, { size: "M", stock: 0 }],
  };
  it("acepta un producto válido", () => expect(productFullSchema.safeParse(ok).success).toBe(true));
  it.each(["http://abc.public.blob.vercel-storage.com/a.jpg", "javascript:alert(1)", "https://evil.com/a.jpg", "https://abc.public.blob.vercel-storage.com.evil.com/a.jpg", ""])(
    "rechaza la foto %s", (url) => expect(productFullSchema.safeParse({ ...ok, images: [url] }).success).toBe(false));
  it.each(["red", "#fff", "#GGGGGG", "ff0000", ""])("rechaza el color %s", (colorHex) =>
    expect(productFullSchema.safeParse({ ...ok, colorHex }).success).toBe(false));
  it("exige color con nombre, al menos una talla y tallas sin repetir (ignorando mayúsculas)", () => {
    expect(productFullSchema.safeParse({ ...ok, colorName: "  " }).success).toBe(false);
    expect(productFullSchema.safeParse({ ...ok, variants: [] }).success).toBe(false);
    expect(productFullSchema.safeParse({ ...ok, variants: [{ size: "m", stock: 1 }, { size: "M", stock: 2 }] }).success).toBe(false);
  });
  it("rechaza stock negativo o fraccionario y oferta mayor o igual al precio", () => {
    expect(productFullSchema.safeParse({ ...ok, variants: [{ size: "S", stock: -1 }] }).success).toBe(false);
    expect(productFullSchema.safeParse({ ...ok, variants: [{ size: "S", stock: 1.5 }] }).success).toBe(false);
    expect(productFullSchema.safeParse({ ...ok, salePrice: 50000 }).success).toBe(false);
  });
});
```
Run → Expected: FAIL.

- [ ] **Step 2: Implementar `src/lib/colors.ts`**

```ts
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
```

- [ ] **Step 3: Validador `productFullSchema`**

En `src/lib/validators.ts`: sacar el objeto base de `productSchema` a `productBase` (`z.object({...})` con name, description, categoryId, price, salePrice, active) y construir `productSchema = productBase.refine(...)` (sin cambiar su comportamiento) y:
```ts
export const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/.+/i;

export const productFullSchema = productBase
  .extend({
    colorName: z.string().trim().min(1, "Ponle nombre al color").max(40),
    colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
    modelId: z.string().min(1).max(64).optional(),
    images: z.array(z.string().regex(BLOB_URL, "Foto inválida")).max(12),
    variants: z.array(z.object({
      size: z.string().trim().min(1, "Talla vacía").max(10),
      stock: z.number().int().min(0).max(100000),
    })).min(1, "Agrega al menos una talla").max(30),
  })
  .refine((p) => p.salePrice === null || p.salePrice < p.price, { message: "La oferta debe ser menor al precio", path: ["salePrice"] })
  .refine((p) => new Set(p.variants.map((v) => v.size.trim().toUpperCase())).size === p.variants.length, { message: "Hay tallas repetidas", path: ["variants"] });
export type ProductFullInput = z.infer<typeof productFullSchema>;
```
(Si zod v4 no permite `extend` sobre `productBase` por alguna razón, construir el objeto completo explícitamente; `productBase` no lleva refinamientos precisamente para poder extenderse.)

- [ ] **Step 4: Verificar y commit**

Run: `/usr/bin/env npx vitest run tests/unit/colors.test.ts tests/unit/lib.test.ts` → PASS.
```bash
git add src/lib tests/unit && git commit -m "feat(lib): paleta y nombre de color, validador de producto completo"
```

---

### Task 3: Lógica de productos (crear, editar, eliminar)

**Files:**
- Modify: `src/server/products.ts`, `tests/unit/products.test.ts`

**Interfaces:**
- Consumes: `ProductFullInput` (Task 2), `normalizeSizes` (ya existe), `slugify`, esquema nuevo (Task 1), `seedProduct` nuevo.
- Produces (`src/server/products.ts`, sin imports de `next/*`):
```ts
export type ProductInput = Omit<ProductFullInput, "variants"> & { variants: { size: string; stock: number }[] };
createProductFull(db: Db, input: ProductInput): Promise<{ id: number; slug: string; modelId: string }>
updateProductFull(db: Db, id: number, input: ProductInput): Promise<{ id: number; slug: string; removedImages: string[] } | null>   // null si no existe
deleteProduct(db: Db, id: number): Promise<{ status: "deleted"; imageUrls: string[] } | { status: "has_orders" } | { status: "not_found" }>
getProductEditData(db: Db, id: number): Promise<null | { product: typeof products.$inferSelect; images: { url: string }[]; variants: { id: number; size: string; stock: number }[]; siblings: { id: number; slug: string; colorName: string; colorHex: string; active: boolean }[] }>
hasOrders(db: Db, productId: number): Promise<boolean>
```
- Se **eliminan** de `products.ts`: `createProduct`, `updateProduct`, `parseColorLines`, `generateVariants`, `removeVariant`, `addImage`, `removeImage`, `moveImage` (y las pruebas que solo los cubrían). Se conserva `normalizeSizes`.

- [ ] **Step 1: Pruebas que fallan**

Reemplazar `tests/unit/products.test.ts` (conservar y adaptar las pruebas de `normalizeSizes` si existen) por:
```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createProductFull, updateProductFull, deleteProduct, getProductEditData, hasOrders } from "@/server/products";
import { createOrder, confirmOrder, cancelOrder } from "@/server/orders";
import { orderItems, productImages, products, stockMovements, variants } from "@/db/schema";

const BLOB = "https://abc123.public.blob.vercel-storage.com/products";
const base = {
  name: "Blusa Basic", description: "", categoryId: null, price: 50000, salePrice: null, active: true,
  colorName: "Rojo", colorHex: "#ff0000", images: [`${BLOB}/a.jpg`, `${BLOB}/b.jpg`],
  variants: [{ size: "S", stock: 3 }, { size: "M", stock: 0 }],
};
const who = { name: "Juan", phone: "3001234567" };
const count = async (db: any, t: any) => (await db.select().from(t)).length;

describe("createProductFull", () => {
  it("crea producto + fotos + variantes + movimientos de stock inicial", async () => {
    const db = await makeTestDb();
    const r = await createProductFull(db, base);
    expect(r.slug).toBe("blusa-basic-rojo");
    expect(r.modelId).toBeTruthy();
    const imgs = await db.select().from(productImages).where(eq(productImages.productId, r.id)).orderBy(productImages.position);
    expect(imgs.map((i) => i.url)).toEqual(base.images);
    const vs = await db.select().from(variants).where(eq(variants.productId, r.id));
    expect(vs.map((v) => [v.size, v.stock]).sort()).toEqual([["M", 0], ["S", 3]]);
    const mv = await db.select().from(stockMovements);
    expect(mv).toHaveLength(1);
    expect(mv[0]).toMatchObject({ delta: 3, reason: "manual", orderId: null });
  });

  it("dos productos con el mismo nombre y color: el segundo recibe sufijo, sin error", async () => {
    const db = await makeTestDb();
    const a = await createProductFull(db, base);
    const b = await createProductFull(db, base);
    expect(a.slug).toBe("blusa-basic-rojo");
    expect(b.slug).toBe("blusa-basic-rojo-2");
  });

  it("con modelId existente se une al grupo; sin modelId crea uno nuevo", async () => {
    const db = await makeTestDb();
    const a = await createProductFull(db, base);
    const b = await createProductFull(db, { ...base, colorName: "Negro", colorHex: "#000000", modelId: a.modelId });
    const c = await createProductFull(db, { ...base, colorName: "Azul", colorHex: "#1976d2" });
    expect(b.modelId).toBe(a.modelId);
    expect(c.modelId).not.toBe(a.modelId);
  });

  it("normaliza tallas y rechaza duplicadas sin crear nada", async () => {
    const db = await makeTestDb();
    const ok = await createProductFull(db, { ...base, variants: [{ size: " m ", stock: 1 }] });
    const [v] = await db.select().from(variants).where(eq(variants.productId, ok.id));
    expect(v.size).toBe("M");
    await expect(createProductFull(db, { ...base, variants: [{ size: "m", stock: 1 }, { size: "M", stock: 2 }] })).rejects.toThrow(/duplicada/i);
    expect(await count(db, products)).toBe(1);
  });

  it("es todo o nada: un fallo tras insertar el producto deshace todo", async () => {
    const db = await makeTestDb();
    // stock negativo viola el CHECK de variants después de insertar producto y fotos
    await expect(createProductFull(db, { ...base, variants: [{ size: "S", stock: -1 }] })).rejects.toThrow();
    expect(await count(db, products)).toBe(0);
    expect(await count(db, productImages)).toBe(0);
    expect(await count(db, stockMovements)).toBe(0);
    // categoría inexistente: falla en el primer insert
    await expect(createProductFull(db, { ...base, categoryId: 99999 })).rejects.toThrow();
    expect(await count(db, products)).toBe(0);
  });
});

describe("updateProductFull", () => {
  it("conserva el slug, reemplaza fotos y devuelve las quitadas", async () => {
    const db = await makeTestDb();
    const { id, slug } = await createProductFull(db, base);
    const r = await updateProductFull(db, id, { ...base, name: "Blusa Nueva", colorName: "Vino", colorHex: "#7b1e3a", images: [`${BLOB}/b.jpg`, `${BLOB}/c.jpg`] });
    expect(r).not.toBeNull();
    expect(r!.slug).toBe(slug);
    expect(r!.removedImages).toEqual([`${BLOB}/a.jpg`]);
    const [p] = await db.select().from(products).where(eq(products.id, id));
    expect(p).toMatchObject({ name: "Blusa Nueva", colorName: "Vino", colorHex: "#7b1e3a", slug });
    const imgs = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.position);
    expect(imgs.map((i) => i.url)).toEqual([`${BLOB}/b.jpg`, `${BLOB}/c.jpg`]);
  });

  it("añade tallas nuevas (con movimiento) y no cambia el stock de las existentes", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base); // S:3, M:0
    await updateProductFull(db, id, { ...base, variants: [{ size: "S", stock: 99 }, { size: "M", stock: 99 }, { size: "L", stock: 4 }] });
    const vs = Object.fromEntries((await db.select().from(variants).where(eq(variants.productId, id))).map((v) => [v.size, v.stock]));
    expect(vs).toEqual({ S: 3, M: 0, L: 4 });
    const mv = await db.select().from(stockMovements);
    expect(mv.map((m) => m.delta).sort()).toEqual([3, 4]);
  });

  it("quita una talla sin pedidos (se borra)", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base);
    await updateProductFull(db, id, { ...base, variants: [{ size: "S", stock: 0 }] });
    expect((await db.select().from(variants).where(eq(variants.productId, id))).map((v) => v.size)).toEqual(["S"]);
  });

  it("quitar una talla CON pedidos la deja en stock 0 con movimiento y no la borra", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base);
    const [s] = await db.select().from(variants).where(eq(variants.productId, id)).then((r) => r.filter((v) => v.size === "S"));
    const o = await createOrder(db, { ...who, items: [{ variantId: s.id, qty: 1 }] });
    expect(o.ok).toBe(true);
    await updateProductFull(db, id, { ...base, variants: [{ size: "M", stock: 0 }] });
    const after = await db.select().from(variants).where(eq(variants.id, s.id));
    expect(after).toHaveLength(1);
    expect(after[0].stock).toBe(0);
    const mv = await db.select().from(stockMovements).where(eq(stockMovements.variantId, s.id));
    expect(mv.map((m) => m.delta).sort()).toEqual([-3, 3]);
  });

  it("devuelve null si el producto no existe", async () => {
    const db = await makeTestDb();
    expect(await updateProductFull(db, 12345, base)).toBeNull();
  });
});

describe("deleteProduct", () => {
  it("borra un producto sin pedidos, con sus variantes/fotos/movimientos, y devuelve las fotos", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base);
    const r = await deleteProduct(db, id);
    expect(r).toEqual({ status: "deleted", imageUrls: base.images });
    expect(await count(db, products)).toBe(0);
    expect(await count(db, variants)).toBe(0);
    expect(await count(db, productImages)).toBe(0);
    expect(await count(db, stockMovements)).toBe(0);
  });

  it("con un pedido pendiente: has_orders y nada cambia", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base);
    const [s] = (await db.select().from(variants).where(eq(variants.productId, id))).filter((v) => v.size === "S");
    await createOrder(db, { ...who, items: [{ variantId: s.id, qty: 1 }] });
    expect(await deleteProduct(db, id)).toEqual({ status: "has_orders" });
    expect(await hasOrders(db, id)).toBe(true);
    expect(await count(db, products)).toBe(1);
  });

  it("aunque el único pedido esté cancelado, sigue siendo has_orders (queda el historial)", async () => {
    const db = await makeTestDb();
    const { id } = await createProductFull(db, base);
    const [s] = (await db.select().from(variants).where(eq(variants.productId, id))).filter((v) => v.size === "S");
    const o = await createOrder(db, { ...who, items: [{ variantId: s.id, qty: 1 }] });
    if (!o.ok) throw new Error("setup");
    await confirmOrder(db, o.data.orderId);
    await cancelOrder(db, o.data.orderId);
    expect(await deleteProduct(db, id)).toEqual({ status: "has_orders" });
    expect(await count(db, orderItems)).toBe(1);
  });

  it("not_found", async () => {
    const db = await makeTestDb();
    expect(await deleteProduct(db, 777)).toEqual({ status: "not_found" });
  });
});

describe("getProductEditData", () => {
  it("devuelve producto, fotos, variantes y hermanos del mismo modelo (incluye archivados con su estado)", async () => {
    const db = await makeTestDb();
    const a = await createProductFull(db, base);
    const b = await createProductFull(db, { ...base, colorName: "Negro", colorHex: "#000000", modelId: a.modelId, active: false });
    await createProductFull(db, { ...base, colorName: "Azul", colorHex: "#1976d2" }); // otro modelo
    const d = await getProductEditData(db, a.id);
    expect(d!.product.id).toBe(a.id);
    expect(d!.images.map((i) => i.url)).toEqual(base.images);
    expect(d!.variants.map((v) => v.size).sort()).toEqual(["M", "S"]);
    expect(d!.siblings.map((s) => [s.id, s.active])).toEqual([[b.id, false]]);
    expect(await getProductEditData(db, 999)).toBeNull();
  });
});
```
Run → Expected: FAIL (funciones no definidas).

- [ ] **Step 2: Implementar `src/server/products.ts`**

Reescribir el archivo conservando `normalizeSizes` (y `collapse`) y añadiendo:
```ts
import { and, asc, count, eq, inArray, like, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, productImages, products, stockMovements, variants } from "@/db/schema";
import { slugify } from "@/lib/slug";
import type { ProductFullInput } from "@/lib/validators";

export type ProductInput = Omit<ProductFullInput, "variants"> & { variants: { size: string; stock: number }[] };
type Q = Db; // dentro de una transacción se pasa `tx as unknown as Db` (misma API de consultas)

async function uniqueSlug(q: Q, base: string): Promise<string> {
  const existing = await q.select({ slug: products.slug }).from(products).where(like(products.slug, `${base}%`));
  const taken = new Set(existing.map((r) => r.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

function cleanVariants(input: { size: string; stock: number }[]): { size: string; stock: number }[] {
  const out = input.map((v) => ({ size: normalizeSizes([v.size])[0] ?? "", stock: v.stock }));
  if (out.some((v) => !v.size)) throw new Error("Talla vacía");
  if (new Set(out.map((v) => v.size)).size !== out.length) throw new Error("Talla duplicada");
  return out;
}

async function insertStockMovement(q: Q, variantId: number, delta: number) {
  await q.insert(stockMovements).values({ variantId, delta, reason: "manual", orderId: null });
}

export async function createProductFull(db: Db, input: ProductInput): Promise<{ id: number; slug: string; modelId: string }> {
  const sizes = cleanVariants(input.variants);
  return db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const slug = await uniqueSlug(tx, slugify(`${input.name} ${input.colorName}`) || "producto");
    const modelId = input.modelId ?? crypto.randomUUID();
    const [p] = await tx.insert(products).values({
      name: input.name, slug, description: input.description, categoryId: input.categoryId,
      price: input.price, salePrice: input.salePrice, active: input.active,
      colorName: input.colorName, colorHex: input.colorHex, modelId,
    }).returning({ id: products.id });
    if (input.images.length) {
      await tx.insert(productImages).values(input.images.map((url, position) => ({ productId: p.id, url, position })));
    }
    const rows = await tx.insert(variants).values(sizes.map((v) => ({ productId: p.id, size: v.size, stock: v.stock })))
      .returning({ id: variants.id, stock: variants.stock });
    for (const r of rows) if (r.stock > 0) await insertStockMovement(tx, r.id, r.stock);
    return { id: p.id, slug, modelId };
  });
}

/** Quita una variante: se borra si no tiene ventas; si las tiene, queda en stock 0 con movimiento. */
async function dropVariant(q: Q, v: { id: number; stock: number }) {
  const [{ n }] = await q.select({ n: count() }).from(orderItems).where(eq(orderItems.variantId, v.id));
  if (n > 0) {
    if (v.stock > 0) {
      await q.update(variants).set({ stock: 0 }).where(eq(variants.id, v.id));
      await insertStockMovement(q, v.id, -v.stock);
    }
  } else {
    await q.delete(variants).where(eq(variants.id, v.id));
  }
}

export async function updateProductFull(db: Db, id: number, input: ProductInput) {
  const sizes = cleanVariants(input.variants);
  return db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const [p] = await tx.select().from(products).where(eq(products.id, id)).for("update");
    if (!p) return null;
    await tx.update(products).set({
      name: input.name, description: input.description, categoryId: input.categoryId,
      price: input.price, salePrice: input.salePrice, active: input.active,
      colorName: input.colorName, colorHex: input.colorHex,
    }).where(eq(products.id, id));

    const before = await tx.select({ url: productImages.url }).from(productImages).where(eq(productImages.productId, id));
    await tx.delete(productImages).where(eq(productImages.productId, id));
    if (input.images.length) {
      await tx.insert(productImages).values(input.images.map((url, position) => ({ productId: id, url, position })));
    }
    const removedImages = before.map((b) => b.url).filter((u) => !input.images.includes(u));

    const existing = await tx.select({ id: variants.id, size: variants.size, stock: variants.stock })
      .from(variants).where(eq(variants.productId, id)).orderBy(asc(variants.id)).for("update");
    const bySize = new Map(existing.map((v) => [v.size, v]));
    const wanted = new Set(sizes.map((s) => s.size));
    for (const v of existing) if (!wanted.has(v.size)) await dropVariant(tx, v);
    for (const s of sizes) {
      if (bySize.has(s.size)) continue; // el stock de tallas existentes solo se ajusta con adjustStock
      const [row] = await tx.insert(variants).values({ productId: id, size: s.size, stock: s.stock }).returning({ id: variants.id });
      if (s.stock > 0) await insertStockMovement(tx, row.id, s.stock);
    }
    return { id, slug: p.slug, removedImages };
  });
}

export async function hasOrders(db: Db, productId: number): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(orderItems)
    .innerJoin(variants, eq(orderItems.variantId, variants.id)).where(eq(variants.productId, productId));
  return n > 0;
}

export async function deleteProduct(db: Db, id: number) {
  return db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.id, id)).for("update");
    if (!p) return { status: "not_found" as const };
    if (await hasOrders(tx, id)) return { status: "has_orders" as const };
    const imgs = await tx.select({ url: productImages.url }).from(productImages)
      .where(eq(productImages.productId, id)).orderBy(asc(productImages.position), asc(productImages.id));
    await tx.delete(products).where(eq(products.id, id));
    return { status: "deleted" as const, imageUrls: imgs.map((i) => i.url) };
  });
}

export async function getProductEditData(db: Db, id: number) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) return null;
  const [images, vs, siblings] = await Promise.all([
    db.select({ url: productImages.url }).from(productImages).where(eq(productImages.productId, id))
      .orderBy(asc(productImages.position), asc(productImages.id)),
    db.select({ id: variants.id, size: variants.size, stock: variants.stock }).from(variants).where(eq(variants.productId, id)),
    db.select({ id: products.id, slug: products.slug, colorName: products.colorName, colorHex: products.colorHex, active: products.active })
      .from(products).where(and(eq(products.modelId, product.modelId), ne(products.id, id))).orderBy(asc(products.id)),
  ]);
  return { product, images, variants: vs, siblings };
}
```
Notas: `inArray`/`sql` pueden no usarse (eliminar imports sobrantes para pasar el lint). `crypto.randomUUID()` es global en Node ≥ 19 y Edge. La prueba "quitar una talla CON pedidos" espera movimientos `[-3, 3]`: el `3` del stock inicial de `S` y el `-3` al dejarla en 0 (el pedido pendiente no descuenta stock).

- [ ] **Step 3: Verificar**

Run: `/usr/bin/env npx vitest run tests/unit/products.test.ts` → PASS. Luego `/usr/bin/env npx vitest run` (los archivos de acciones/páginas aún importan funciones eliminadas: **no** afectan a Vitest, que solo corre `tests/unit`; `tsc` seguirá fallando hasta la Task 5, está previsto).

- [ ] **Step 4: Commit**
```bash
git add src/server/products.ts tests/unit/products.test.ts
git commit -m "feat(products): crear, editar y eliminar productos completos en una transacción"
```

---

### Task 4: Capa de datos de la tienda con color por producto

**Files:**
- Modify: `src/server/catalog.ts`, `src/server/orders.ts`, `src/server/stats.ts`, `tests/unit/catalog.test.ts`, `tests/unit/orders.create.test.ts`, `tests/unit/stats.test.ts`

**Interfaces:**
- Consumes: esquema nuevo (Task 1), `seedProduct` nuevo.
- Produces:
```ts
type ColorRef = { slug: string; colorName: string; colorHex: string };
ProductCard = { id; slug; name; price; salePrice; image: string | null; inStock: boolean; colorName: string; colorHex: string; colors: ColorRef[] }   // colors = OTROS productos activos del mismo modelo
getProductBySlug(db, slug) → null | { id; slug; name; description; price; salePrice; categoryName: string | null; colorName: string; colorHex: string;
   images: string[]; variants: { id: number; size: string; stock: number }[];
   siblings: (ColorRef & { inStock: boolean })[] }                                  // activos del mismo modelo, INCLUYE el actual
getFilterOptions(db) → { categories; sizes: string[]; colors: { name: string; hex: string }[] }
getCartLines(db, ids) → líneas con colorName tomado de products
topProducts(db, r, limit?) → { name: string /* "Nombre · Color" */; units: number; revenue: number }[]
```

- [ ] **Step 1: Pruebas que fallan** (añadir/ajustar)

En `tests/unit/catalog.test.ts` añadir:
```ts
describe("colores como productos", () => {
  it("tarjetas: los demás colores del mismo modelo, solo activos y solo del mismo modelo", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { name: "Blusa", color: "Rojo", colorHex: "#ff0000", modelId: "m1" });
    await seedProduct(db, { name: "Blusa", color: "Negro", colorHex: "#000000", modelId: "m1" });
    await seedProduct(db, { name: "Blusa", color: "Azul", colorHex: "#1976d2", modelId: "m1", active: false }); // archivado
    await seedProduct(db, { name: "Otra", color: "Verde", colorHex: "#388e3c", modelId: "m2" });
    const cards = await listProducts(db, {});
    const rojo = cards.find((c) => c.colorName === "Rojo")!;
    expect(rojo.colors.map((c) => c.colorName)).toEqual(["Negro"]);
    expect(cards.find((c) => c.name === "Otra")!.colors).toEqual([]);
    expect(cards).toHaveLength(3); // el archivado no se lista
    expect(a.productId).toBeGreaterThan(0);
  });

  it("producto: siblings incluye el actual y excluye archivados y otros modelos; variantes sin color", async () => {
    const db = await makeTestDb();
    const r = await seedProduct(db, { name: "Blusa", color: "Rojo", colorHex: "#ff0000", modelId: "m1", variants: [{ size: "S", stock: 2 }] });
    await seedProduct(db, { name: "Blusa", color: "Negro", colorHex: "#000000", modelId: "m1", variants: [{ size: "S", stock: 0 }] });
    await seedProduct(db, { name: "Blusa", color: "Azul", colorHex: "#1976d2", modelId: "m1", active: false });
    await seedProduct(db, { name: "Otra", color: "Verde", modelId: "m2" });
    const [p] = await db.select().from(products).where(eq(products.id, r.productId));
    const d = await getProductBySlug(db, p.slug);
    expect(d!.colorName).toBe("Rojo");
    expect(d!.siblings.map((s) => [s.colorName, s.inStock])).toEqual([["Rojo", true], ["Negro", false]]);
    expect(d!.variants[0]).toEqual({ id: expect.any(Number), size: "S", stock: 2 });
    expect(d!.variants[0]).not.toHaveProperty("colorName");
  });

  it("filtro por color usa el color del producto y las opciones salen de productos activos", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "A", color: "Rojo", colorHex: "#ff0000" });
    await seedProduct(db, { name: "B", color: "Negro", colorHex: "#000000" });
    await seedProduct(db, { name: "C", color: "Azul", colorHex: "#1976d2", active: false });
    expect((await listProducts(db, { color: "Rojo" })).map((p) => p.name)).toEqual(["A"]);
    const o = await getFilterOptions(db);
    expect(o.colors.map((c) => c.name)).toEqual(["Negro", "Rojo"]);
  });

  it("líneas de carrito toman el color del producto", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db, { color: "Vino", colorHex: "#7b1e3a" });
    const [l] = await getCartLines(db, variantIds);
    expect(l.colorName).toBe("Vino");
  });
});
```
(importar `getFilterOptions`, `products`, `eq` si faltan). En `orders.create.test.ts` añadir: el snapshot del pedido guarda `colorName` del producto (`seedProduct(db, { color: "Vino", ... })` → `order_items.colorName === "Vino"` y `lines[0].colorName === "Vino"`). En `stats.test.ts`: dos productos del mismo nombre y distinto color vendidos → `topProducts` devuelve dos filas `"A · Rojo"` y `"A · Negro"`; ajustar las aserciones existentes de nombres (`"A"` → `"A · Negro"`, etc.). Run → Expected: FAIL.

- [ ] **Step 2: `catalog.ts`**

Cambios exactos:
```ts
export type ColorRef = { slug: string; colorName: string; colorHex: string };
export type ProductCard = {
  id: number; slug: string; name: string; price: number; salePrice: number | null;
  image: string | null; inStock: boolean; colorName: string; colorHex: string; colors: ColorRef[];
};
```
- `listProducts`: el filtro de color pasa a `conds.push(eq(products.colorName, f.color))`; el `select` añade `colorName: products.colorName, colorHex: products.colorHex, modelId: products.modelId`; tras obtener `rows`, una sola consulta extra:
```ts
const modelIds = [...new Set(rows.map((r) => r.modelId))];
const sibs = modelIds.length === 0 ? [] : await db
  .select({ id: products.id, slug: products.slug, colorName: products.colorName, colorHex: products.colorHex, modelId: products.modelId })
  .from(products).where(and(inArray(products.modelId, modelIds), eq(products.active, true))).orderBy(asc(products.id));
```
y para cada tarjeta `colors = sibs.filter((s) => s.modelId === r.modelId && s.id !== r.id).map(({ slug, colorName, colorHex }) => ({ slug, colorName, colorHex }))` (quitar `modelId` del objeto devuelto).
- `getProductBySlug`: seleccionar además `colorName`, `colorHex`, `modelId`; variantes `{ id, size, stock }` ordenadas por `asc(variants.size)`; `siblings` = productos activos con ese `modelId` (orden `asc(products.id)`), cada uno con `inStock: exists(variants.stock > 0)`; devolver `{ ...p sin modelId, colorName, colorHex, images, variants, siblings }`.
- `getFilterOptions`: tallas = `selectDistinct(variants.size)` de productos activos; colores = `selectDistinct({ name: products.colorName, hex: products.colorHex })` de productos activos con `colorName <> ''`, ordenados por nombre.
- `getCartLines`: `colorName: products.colorName`.
- `redactInactiveLines`: sin cambios.

- [ ] **Step 3: `orders.ts` y `stats.ts`**

`orders.ts` (`createOrder`): en el `select` cambiar `colorName: variants.colorName` por `colorName: products.colorName` (el `innerJoin(products…)` ya existe); en `confirmOrder` (select de `locked`, ~línea 81) cambiar `color: variants.colorName` por `color: products.colorName` (también tiene el join). `stats.ts`: en `lowStock` `colorName: products.colorName` (hay join con products); en `topProducts` agrupar por `orderItems.productName` **y** `orderItems.colorName` y devolver `name` = `` `${productName} · ${colorName}` `` (si `colorName` está vacío, solo el nombre), manteniendo el orden por unidades e ingresos y el `limit`.

- [ ] **Step 4: Verificar y commit**

Run: `/usr/bin/env npx vitest run` → toda la suite PASS. `/usr/bin/env npx tsc --noEmit`: los errores restantes deben limitarse a `demo-data.ts`, páginas/componentes de admin y de tienda (Tasks 5–7).
```bash
git add src/server tests/unit && git commit -m "feat(catalog): color por producto, hermanos del modelo y estadísticas por color"
```

---

### Task 5: Tienda: círculos de color que cambian de producto, y modo demo

**Files:**
- Modify: `src/components/store/VariantPicker.tsx`, `src/components/store/ProductCard.tsx`, `src/app/(store)/producto/[slug]/page.tsx`, `src/server/demo-data.ts`, `src/components/store/useCartLines.ts` (solo si el tipo cambia), `tests/e2e/storefront-demo.spec.ts`

**Interfaces:**
- Consumes: `getProductBySlug`/`ProductCard` de la Task 4 (`siblings`, `colors`, `colorName`, `colorHex`).
- Produces: `VariantPicker` props `{ variants: { id: number; size: string; stock: number }[]; colorName: string; siblings: { slug: string; colorName: string; colorHex: string; inStock: boolean }[]; currentSlug: string; initialSize?: string }`.

- [ ] **Step 1: `VariantPicker`**

Quitar el estado y selector de color y el filtro `variants.filter((v) => v.colorName === color)`: las variantes ya son de este producto. El bloque "Color" pasa a mostrar los `siblings` (cada uno un `<button>` con `router.push(`/producto/${s.slug}${size ? `?talla=${encodeURIComponent(size)}` : ""}`)`, usando `useRouter` de `next/navigation`; el actual `aria-pressed`/`aria-current`, los sin stock con la raya diagonal existente, `aria-label` = nombre del color (+ " (agotado)")). La leyenda muestra `colorName`. El estado `size` se inicializa con `initialSize` si existe y tiene stock > 0 (`variants.find(v => v.size === initialSize && v.stock > 0)`). Las tallas se ordenan con `sortSizes`; el resto de la lógica (cantidad, tope `min(stock, MAX_QTY_PER_LINE)`, "Quedan N", mensajes) no cambia. Si hay un solo producto en el grupo (`siblings.length <= 1`) no se muestra el bloque de colores, solo un texto con el nombre del color.

- [ ] **Step 2: Página de producto y tarjeta**

`producto/[slug]/page.tsx`: aceptar `searchParams: Promise<{ talla?: string | string[] }>`, tomar el primer valor, y pasar a `<VariantPicker variants={p.variants} colorName={p.colorName} siblings={p.siblings} currentSlug={p.slug} initialSize={talla} />`. El título H1 pasa a `p.name` con el color debajo en texto secundario (`p.colorName`); `generateMetadata`: `title: `${p.name} · ${p.colorName}``. `soldOut` se calcula como hoy sobre `p.variants`.
`ProductCard.tsx`: bajo el precio, fila de pequeños círculos (`aria-hidden`, `title` con el nombre) con el color propio primero y los de `product.colors` después (máx. 5; si hay más, `+N`); mostrar el color en texto pequeño ("Rojo"). La tarjeta sigue siendo un solo `<Link>` (los círculos **no** son enlaces anidados).

- [ ] **Step 3: Modo demo**

Reescribir `demo-data.ts` para el nuevo modelo: cada combinación (semilla × color) es **un producto** con `id` propio, `slug` `${seed.slug}-${color.toLowerCase()}`, `colorName`, `colorHex`, `modelId` = `seed.slug`, variantes solo `{ id, size, stock }`; `demoListProducts` calcula `colors` (otros del mismo `modelId`, solo activos) y filtra por color con `p.colorName === f.color`; `demoProduct(slug)` devuelve `siblings` (incluido el actual, con `inStock`); `demoFilterOptions().colors` desde los productos; `demoCartLines` toma el color del producto. Mantener las mismas semillas (misma cantidad de modelos y colores) para que la demo se vea igual que antes, pero ahora con tarjetas por color.

- [ ] **Step 4: E2E demo**

En `tests/e2e/storefront-demo.spec.ts` leer los selectores actuales y adaptarlos: el flujo "producto → color → talla → carrito" ahora entra por un producto (p. ej. `/producto/camiseta-pausa-negro`), elige talla y agrega. Añadir la prueba:
```ts
test("cambiar de color cambia de producto", async ({ page }) => {
  await page.goto("/producto/camiseta-pausa-negro");
  await expect(page).toHaveTitle(/Negro/);
  await page.getByRole("button", { name: "Hueso" }).click();
  await expect(page).toHaveURL(/\/producto\/camiseta-pausa-hueso/);
  await expect(page).toHaveTitle(/Hueso/);
});
test("el catálogo muestra una tarjeta por color", async ({ page }) => {
  await page.goto("/tienda");
  await expect(page.getByRole("link", { name: /Camiseta Pausa/ })).toHaveCount(2);
});
```
(ajustar a los nombres/slugs reales de la demo y al orden de títulos).

- [ ] **Step 5: Verificar y commit**

Run: `/usr/bin/env npx tsc --noEmit` (deben quedar solo errores de admin, Task 6), `/usr/bin/env npx eslint src`, `/usr/bin/env npx vitest run`, y `/usr/bin/env npx playwright test --project=demo` (servidor propio en :3200; **no** usar el :3000). Verificar visualmente en el servidor de desarrollo del controlador (`localhost:3000`, modo demo) que `/producto/camiseta-pausa-negro` muestra los círculos y navega al otro color.
```bash
git add src/components/store src/app/\(store\) src/server/demo-data.ts tests/e2e && git commit -m "feat(store): colores como productos con navegación entre hermanos"
```

---

### Task 6: Admin: formulario único, gotero, fotos y eliminar/archivar

**Files:**
- Create: `src/components/admin/{ProductEditor,ColorPicker,PhotoUploader,SizeStockEditor,ProductActions}.tsx`
- Modify: `src/app/api/admin/upload/route.ts`, `src/app/admin/productos/actions.ts`, `src/app/admin/productos/page.tsx`, `src/app/admin/productos/nuevo/page.tsx`, `src/app/admin/productos/[id]/page.tsx`
- Delete: `src/components/admin/{ProductForm,ImageManager,VariantGrid}.tsx`
- Test: `tests/unit/upload-validation.test.ts` (si se extrae la validación a una función pura)

**Interfaces:**
- Consumes: `createProductFull`, `updateProductFull`, `deleteProduct`, `getProductEditData`, `hasOrders` (Task 3); `productFullSchema` (Task 2); `nearestColorName` (Task 2); `adjustStock` (existente).
- Produces:
  - `POST /api/admin/upload` → `{ urls: string[] }` (solo sube; 401 sin sesión).
  - Server Actions (`"use server"`, todas con `await requireAdmin()` al inicio):
    ```ts
    saveProductFull(id: number | null, prev: Result, fd: FormData): Promise<Result>   // fd.get("payload") = JSON de ProductFullInput
    deleteProductAction(id: number, prev: Result): Promise<Result>                    // redirige a /admin/productos si se borró
    toggleActive(fd: FormData): Promise<void>                                          // existente
    setStockAction(variantId: number, prev: Result, fd: FormData): Promise<Result>     // existente
    ```
    con `type Result = { error?: string; ok?: string } | undefined`.

- [ ] **Step 1: Ruta de subida (solo sube)**

Reescribir `src/app/api/admin/upload/route.ts`: conserva autenticación (`readSession`), validación de tipo/extensión/4 MB y `BLOB_READ_WRITE_TOKEN`; **elimina** `productId`, `addImage`, `revalidate*` y la lectura de la base; recibe `files` (uno o varios), sube cada uno con `put(`products/${Date.now()}-${safeName}`, f, { access: "public", addRandomSuffix: true, contentType: f.type })` y responde `{ urls: string[] }`. Extraer la validación a una función pura `validateImageFile({ name, type, size }): string | null` en `src/lib/upload.ts` con prueba `tests/unit/upload-validation.test.ts` (jpg/png/webp válidos; `.exe`, tipo `text/html`, extensión que no coincide, 4 MB + 1 byte → mensaje de error; exactamente 4 MB → `null`). TDD: prueba primero (FAIL), luego implementar.

- [ ] **Step 2: `ColorPicker`**

`src/components/admin/ColorPicker.tsx` (cliente):
```tsx
"use client";
import { useEffect, useState } from "react";
import { nearestColorName } from "@/lib/colors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> };

export function ColorPicker({ colorName, colorHex, onChange }: {
  colorName: string; colorHex: string; onChange: (v: { colorName: string; colorHex: string }) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [nameTouched, setNameTouched] = useState(colorName !== "");
  useEffect(() => { setSupported("EyeDropper" in window); }, []);

  function setHex(hex: string) {
    const h = hex.toLowerCase();
    onChange({ colorHex: h, colorName: nameTouched ? colorName : nearestColorName(h) });
  }
  async function pick() {
    try {
      const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
      const r = await new Ctor().open();
      setHex(r.sRGBHex);
    } catch { /* el usuario canceló */ }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="colorHex">Color</Label>
          <input id="colorHex" type="color" value={colorHex} onChange={(e) => setHex(e.target.value)}
            className="h-12 w-16 cursor-pointer rounded border border-neutral-300 bg-transparent p-1" />
        </div>
        {supported && <Button type="button" variant="outline" onClick={pick}>Gotero</Button>}
        <div className="space-y-2">
          <Label htmlFor="colorName">Nombre del color</Label>
          <Input id="colorName" value={colorName} maxLength={40} required
            onChange={(e) => { setNameTouched(true); onChange({ colorHex, colorName: e.target.value }); }} />
        </div>
        <div className="size-12 rounded-full border border-neutral-300" style={{ backgroundColor: colorHex }} aria-hidden />
      </div>
      <p className="text-xs text-neutral-500">Elige el color o usa el gotero para tomarlo de cualquier parte de la pantalla. El nombre se propone solo; puedes editarlo.</p>
    </div>
  );
}
```
(El valor inicial de un producto nuevo: `colorHex = "#000000"`, `colorName = ""`; al elegir un color por primera vez el nombre se propone solo.)

- [ ] **Step 3: `PhotoUploader`**

Cliente. Props `{ urls: string[]; onChange: (urls: string[]) => void }`. Un `<input type="file" multiple accept="image/jpeg,image/png,image/webp">`; por cada archivo (secuencial) `fetch("/api/admin/upload", { method: "POST", body })` con **un** archivo; añade la URL devuelta (`data.urls[0]`) al final; errores por archivo como en el `ImageManager` anterior (JSON `error`, 413 → "El archivo supera el límite de la plataforma", red → "Error de red"), mostrados en una línea `role="alert"`; cada miniatura (`<img>`, la primera marcada "Principal") con botones ← → (reordenan el arreglo) y "Quitar" (lo saca del arreglo; **no** borra el archivo de Blob todavía). El estado "subiendo" deshabilita el input y el botón Guardar del formulario padre (`onBusyChange?: (busy: boolean) => void`).

- [ ] **Step 4: `SizeStockEditor`**

Cliente. Props `{ rows: { size: string; stock: number; variantId?: number }[]; onChange: (rows) => void; threshold: number }`. Chips con `SIZE_SUGGESTIONS` (`sortSizes`) que añaden/quitan una fila; campo "Otra talla" + botón "Agregar" (normaliza con `trim().toUpperCase()` y evita repetidas); tabla de filas ordenadas con `sortSizes`:
- fila **nueva** (`variantId` indefinido): `<Input type="number" min=0 step=1>` con el stock inicial y botón quitar;
- fila **existente** (`variantId`): stock actual solo lectura (rojo si `<= threshold`) y el control `+ / −` con cantidad que llama a `setStockAction.bind(null, variantId)` (mover aquí el `StockCell` del antiguo `VariantGrid`, con el `+` primero en el DOM para que Enter sume) y botón "Quitar talla" (la saca de `rows`; se aplica al guardar).
Mensaje de ayuda: "El stock de tallas ya guardadas se ajusta aquí con +/−; queda registrado."

- [ ] **Step 5: `ProductEditor`**

Cliente. Props:
```ts
{ mode: "new" | "edit"; id: number | null; categories: { id: number; name: string }[]; threshold: number;
  initial: { name: string; description: string; categoryId: number | null; price: number | ""; salePrice: number | "";
             active: boolean; colorName: string; colorHex: string; images: string[]; modelId?: string;
             rows: { size: string; stock: number; variantId?: number }[] } }
```
Estado local para todos los campos; `useActionState(saveProductFull.bind(null, id), undefined)`. Estructura en cuatro `Card`s: **Datos** (nombre, descripción, categoría `<select>`, precio, oferta, activo), **Color** (`ColorPicker`), **Fotos** (`PhotoUploader`), **Tallas y stock** (`SizeStockEditor`). El `<form action={action}>` incluye `<input type="hidden" name="payload" value={JSON.stringify({ name, description, categoryId, price: Number(price), salePrice: salePrice === "" ? null : Number(salePrice), active, colorName, colorHex, modelId, images, variants: rows.map(({ size, stock }) => ({ size, stock })) })} />`. Botón "Guardar" deshabilitado mientras sube fotos o `pending`; mensaje `role="alert"`/`status` con `state.error`/`state.ok`. En `mode === "new"` el título es "Nuevo producto" (o "Nuevo color de <nombre>" cuando viene de `?desde`).

- [ ] **Step 6: Acciones**

`src/app/admin/productos/actions.ts`: eliminar `saveProduct`, `generateVariantsAction`, `removeVariantAction`, `removeImageAction`, `moveImageAction`; conservar `toggleActive` y `setStockAction`; añadir:
```ts
export async function saveProductFull(id: number | null, _: unknown, fd: FormData): Promise<Result> {
  await requireAdmin();
  let raw: unknown;
  try { raw = JSON.parse(String(fd.get("payload") ?? "")); } catch { return { error: "Datos inválidos" }; }
  const parsed = productFullSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = getDb();
  try {
    if (id === null) {
      const created = await createProductFull(db, parsed.data);
      refresh();
      redirect(`/admin/productos/${created.id}`);
    }
    const updated = await updateProductFull(db, id, parsed.data);
    if (!updated) return { error: "El producto ya no existe" };
    refresh();
    revalidatePath(`/admin/productos/${id}`);
    await deleteBlobs(updated.removedImages);
    return { ok: "Guardado" };
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: e instanceof Error && /Talla/.test(e.message) ? e.message : "No se pudo guardar el producto" };
  }
}

export async function deleteProductAction(id: number, _: unknown): Promise<Result> {
  await requireAdmin();
  if (!Number.isInteger(id) || id < 1) return { error: "Producto inválido" };
  const r = await deleteProduct(getDb(), id);
  if (r.status === "has_orders") return { error: "Este producto tiene pedidos: no se puede eliminar, solo archivar." };
  if (r.status === "not_found") return { error: "El producto ya no existe" };
  await deleteBlobs(r.imageUrls);
  refresh();
  redirect("/admin/productos");
}
```
con `deleteBlobs(urls)` = `try { if (urls.length && process.env.BLOB_READ_WRITE_TOKEN) await del(urls); } catch (e) { console.error("No se pudieron borrar fotos de Blob", e); }` (`import { del } from "@vercel/blob"`), y `isNextRedirect` = `(e) => typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")` (el `redirect()` de Next lanza una excepción: no debe capturarse como error de guardado). `refresh()` ya invalida `catalog` y `/admin/productos`.

- [ ] **Step 7: `ProductActions` y páginas**

`ProductActions.tsx` (cliente): props `{ id: number; name: string; active: boolean; hasOrders: boolean }`. Si `hasOrders`: botón **Archivar** (o **Reactivar** si `!active`) que envía el formulario de `toggleActive` (hidden `id` y `active`) tras un `Dialog` de confirmación que explica "se conserva el historial de pedidos; no se verá en la tienda". Si no: botón **Eliminar** (destructivo) con `Dialog` ("Se borrará el producto, sus fotos y su stock. No se puede deshacer.") que ejecuta `useActionState(deleteProductAction.bind(null, id), undefined)` y muestra `state.error`. Mirar `src/components/admin/OrderActions.tsx` para replicar el patrón de `Dialog`/`DialogTrigger render={...}` del repo.
`nuevo/page.tsx`: `requireAdmin()`; leer `searchParams.desde` (entero positivo); si existe `getProductEditData(db, desde)`: `initial` = nombre, descripción, categoría, precio, oferta, `active: true`, `colorName: ""`, `colorHex: "#000000"`, `images: []`, `modelId` del origen, `rows` = tallas del origen con `stock: 0`; si no, valores vacíos con `rows: []`. Cargar categorías y `getSettings(db).lowStockThreshold`. Renderizar `<ProductEditor mode="new" ... />`.
`[id]/page.tsx`: `requireAdmin()`, `getProductEditData` (`notFound()` si null), `hasOrders`; encabezado con nombre, círculo y nombre del color, enlace "← Productos", botón "Agregar otro color" → `/admin/productos/nuevo?desde=${id}`, lista de hermanos (círculo + enlace a su edición + etiqueta "Archivado"), `ProductActions`, y `<ProductEditor mode="edit" ... rows={variants → { size, stock, variantId }}>`.
`page.tsx` (lista): añadir `colorName`, `colorHex`, y `hasOrders` (`exists(select 1 from order_items oi join variants v on v.id = oi.variant_id where v.product_id = products.id)`) al select; mostrar el círculo de color y el nombre del color junto al nombre; badge "Archivado"/"Activo"; columna de acciones con `ProductActions` por fila (reemplaza el botón Ocultar/Activar).

- [ ] **Step 8: Borrar componentes obsoletos y verificar**

`git rm src/components/admin/{ProductForm,ImageManager,VariantGrid}.tsx`. Run: `/usr/bin/env npx tsc --noEmit` (**debe quedar limpio**; ignorar solo errores de `.next/types` obsoletos), `/usr/bin/env npx eslint src tests`, `/usr/bin/env npx vitest run`, y `NEXT_DIST_DIR=.next-build DATABASE_URL=postgres://u:p@localhost:5432/x SESSION_SECRET=$(printf 'x%.0s' {1..40}) /usr/bin/env npm run build` (nunca el `.next` por defecto). Anotar en el reporte que las pantallas de admin no se pudieron ejecutar sin base de datos ni sesión.

- [ ] **Step 9: Commit**
```bash
git add -A src tests && git commit -m "feat(admin): formulario único de producto con gotero, fotos previas, tallas y eliminar/archivar"
```

---

### Task 7: E2E, README y verificación final

**Files:**
- Modify: `tests/e2e/global-setup.ts`, `tests/e2e/flow.spec.ts`, `README.md`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: E2E con base de datos (gated)**

`tests/e2e/global-setup.ts`: el producto sembrado `camiseta-e2e` ahora inserta `colorName: "Negro"`, `colorHex: "#000000"`, `modelId: "m-e2e"` y su variante `M` solo con `stock: 5` (sin color en la variante). `tests/e2e/flow.spec.ts`: el selector del producto elige la talla (ya no el color) y la comprobación de stock en admin usa la nueva fila de `SizeStockEditor` (stock actual como texto en la tabla de tallas del editor); añadir una prueba, también gated por `E2E_DATABASE_URL`, que crea un producto desde `/admin/productos/nuevo` (nombre, color por el selector, talla `M` con stock 2, sin fotos), verifica que aparece en `/tienda`, y luego lo elimina desde su página (diálogo "Eliminar") comprobando que desaparece. Sigue sin poder ejecutarse en este entorno: decirlo en el reporte.

- [ ] **Step 2: README**

Añadir (en español, conciso): sección "Cargar productos" (un producto = un color; "Agregar otro color" para el mismo modelo; fotos se suben antes de guardar; tallas con stock inicial; el stock de tallas existentes se ajusta con +/−), "Eliminar vs archivar" (regla de pedidos), y en "Despliegue" el procedimiento de esta entrega: (1) consulta de verificación previa en Neon
```sql
select p.name from products p
where (select count(distinct v.color_name) from variants v where v.product_id = p.id) > 1;
```
(debe devolver 0 filas), (2) `DATABASE_URL="<url>" npm run db:migrate`, (3) subir a `main`; nota de que la limpieza de las columnas viejas de color en `variants` queda para una migración posterior.

- [ ] **Step 3: Verificación completa**

Run: `/usr/bin/env npx vitest run` (todo verde), `/usr/bin/env npx tsc --noEmit`, `/usr/bin/env npm run lint`, `NEXT_DIST_DIR=.next-build DATABASE_URL=postgres://u:p@localhost:5432/x SESSION_SECRET=$(printf 'x%.0s' {1..40}) /usr/bin/env npm run build`, `/usr/bin/env npx playwright test --project=demo` (servidor propio en :3200). Revertir cualquier cambio automático de `tsconfig.json` que dejen los servidores de desarrollo (`git checkout tsconfig.json`).

- [ ] **Step 4: Commit**
```bash
git add tests/e2e README.md && git commit -m "test(e2e): flujo con color por producto y alta/baja desde admin; README"
```

---

## Self-Review

**Cobertura del spec**
- §1 decisiones (eliminar vs archivar, color por producto, agrupación, catálogo, carga atómica, gotero, datos existentes): Tasks 1, 3, 5, 6.
- §2 modelo de datos y migración 0002 (aditiva, chequeo previo, defaults, índices): Task 1.
- §3 servidor (`createProductFull`, `updateProductFull`, `deleteProduct`, `nearestColorName`, `catalog.ts`, `createOrder`, `stats`): Tasks 2–4.
- §4 admin (formulario de cuatro bloques, subida solo-sube, "Agregar otro color", eliminar/archivar, lista con color): Task 6.
- §5 tienda (círculos que navegan, tarjetas por color, carrito/WhatsApp, demo, caché): Tasks 4–5 (carrito y WhatsApp no cambian de formato: `colorName` sale de `products`).
- §6 seguridad y errores (`requireAdmin`, URLs de Blob, resultados tipados): Tasks 2, 6.
- §7 pruebas: migración (T1), color (T2), productos (T3), catálogo/pedidos/estadísticas (T4), e2e (T5, T7).
- §8 despliegue: README y pasos en Task 7; la ejecución (consulta previa en Neon, migrar, subir) la hace el controlador/usuario fuera del plan.

**Consistencia de tipos:** `ProductFullInput` (T2) → `ProductInput` (T3) → payload de `ProductEditor` (T6); `getProductBySlug.siblings` y `variants` (T4) → props de `VariantPicker` (T5); `ProductCard.colors` (T4) → `ProductCard.tsx` (T5); `getProductEditData` (T3) → páginas admin (T6).

**Placeholders:** ninguno. Las tareas de UI (T5, T6) describen cada componente por props, estado y comportamiento, con el código de las piezas con lógica (ColorPicker, acciones); los demás siguen los patrones ya existentes en el repo indicados por archivo.

**Riesgos conocidos:** (a) Tras la Task 1 `tsc` no compila hasta la Task 6 (esquema cambiado antes que los consumidores): se acepta porque no se despliega entre tareas. (b) El gotero (`EyeDropper`) solo existe en Chrome/Edge de escritorio: en otros navegadores solo queda el selector nativo. (c) La e2e con base de datos sigue sin ejecutarse en este entorno.
