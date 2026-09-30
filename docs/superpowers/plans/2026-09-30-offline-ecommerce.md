# OFFLINE Ecommerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tienda de ropa OFFLINE con pedidos por WhatsApp y panel admin que confirma pedidos, descuenta inventario y muestra ventas.

**Architecture:** Un solo repo Next.js (App Router) en Vercel. Lógica de negocio transaccional en `src/server/*` recibe la `db` por parámetro (Postgres real en prod vía `pg`, PGlite en tests). Server Actions y páginas son capas finas sobre `server/`. Auth propio con cookie JWT (`jose`) y `bcryptjs`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind + shadcn/ui, Drizzle ORM + `pg` (Neon Postgres), `@vercel/blob`, `jose`, `bcryptjs`, `zod`, `recharts`, Vitest + `@electric-sql/pglite`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-offline-ecommerce-design.md`

## Global Constraints

- Moneda COP, enteros sin decimales. Formato visible `$89.900` (puntos de miles, sin decimales).
- WhatsApp: prefijo +57, enlace `https://wa.me/57<numero>?text=<urlencoded>`. Sin API ni cuenta Business.
- Teléfono cliente: móvil colombiano, 10 dígitos, inicia en 3 (se aceptan `+57`, espacios y guiones al escribir; se normaliza a 10 dígitos).
- Envío fuera del sistema: el total solo suma productos.
- Stock baja solo al confirmar; pendientes no reservan. Confirmar es todo-o-nada.
- Transiciones: `pending→confirmed`, `confirmed→cancelled`, `pending→cancelled`. `cancelled→*` prohibido.
- Productos/variantes con ventas no se borran (producto → `active=false`, variante → stock 0).
- Código de pedido `OFF-0001` (secuencia Postgres, 4 dígitos mínimo).
- Un solo admin. Sesión 7 días, cookie httpOnly. Cada Server Action admin revalida sesión.
- Subida de imágenes: solo jpg/png/webp, **máx. 4 MB** (desviación del spec, que decía 5 MB: el límite de cuerpo de una función Vercel es 4,5 MB).
- Sin servicios externos aparte de Vercel, Neon (Marketplace) y Vercel Blob.
- Zona horaria de reportes: `America/Bogota`.

## Review Focus

Entradas que el spec implica y que no cubren las pruebas "felices":

1. `qty` = 0, negativa, fraccionaria o enorme en el carrito/pedido → rechazado, nunca crea pedido (Task 4).
2. Nombre del cliente con `&`, `#`, `%`, emoji, tildes o salto de línea → el mensaje `wa.me` llega íntegro y una sola línea por campo (Task 3).
3. Misma variante repetida en líneas distintas del carrito → se suma, no se duplica ni se salta la validación de stock (Task 4).
4. Confirmar dos veces, o confirmar un pedido cuya variante fue borrada → sin doble descuento, error tipado (Task 5).
5. Teléfono con `+57`, espacios, guiones o 9/11 dígitos → normaliza o rechaza con mensaje claro (Task 3).

---

## File Structure

```
package.json, tsconfig.json, next.config.ts, drizzle.config.ts, vitest.config.ts, playwright.config.ts, .env.example
scripts/seed-admin.ts
src/db/schema.ts            esquema Drizzle (única fuente del modelo)
src/db/client.ts            pool pg + drizzle (prod/dev) y tipo Db
src/db/migrations/          SQL generado por drizzle-kit
src/lib/money.ts            formatCop
src/lib/phone.ts            normalizePhone
src/lib/whatsapp.ts         buildOrderMessage, buildWaUrl
src/lib/validators.ts       zod: checkout, producto, categoría, ajustes
src/server/types.ts         Result, OrderError
src/server/orders.ts        createOrder, confirmOrder, cancelOrder, adjustStock
src/server/catalog.ts       consultas del catálogo público y admin
src/server/stats.ts         métricas del dashboard
src/server/ratelimit.ts     hit()
src/server/auth.ts          hash/verify, sesión JWT, requireAdmin
src/app/(store)/...         páginas públicas
src/app/admin/...           panel
src/app/api/admin/upload/route.ts
src/components/{ui,store,admin}/
tests/helpers/db.ts         makeTestDb + factories
tests/unit/*.test.ts, tests/e2e/*.spec.ts
```

---

### Task 1: Scaffold, herramientas y repo

**Files:**
- Create: todo el proyecto Next.js, `vitest.config.ts`, `.env.example`, `.gitignore` (lo trae Next)
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: alias `@/*` → `src/*`; scripts `test`, `db:generate`, `db:migrate`, `seed:admin`.

- [ ] **Step 1: Inicializar git y crear el proyecto**

```bash
cd /Users/sebastian/Documents/kodevon/Proyectos/kodevon-ecommerce-offline
git init
npx create-next-app@15 . --ts --tailwind --app --src-dir --eslint --no-turbopack --import-alias "@/*" --use-npm --yes
```
Si se queja de archivos existentes (`docs/`), crear en `../offline-tmp` y mover el contenido (sin tocar `docs/`).

- [ ] **Step 2: Instalar dependencias**

```bash
npm i drizzle-orm pg jose bcryptjs zod recharts @vercel/blob
npm i -D drizzle-kit @types/pg @types/bcryptjs vitest @electric-sql/pglite tsx @playwright/test dotenv
npx shadcn@latest init -d
npx shadcn@latest add button input label select dialog table badge card textarea checkbox
```

- [ ] **Step 3: Configurar Vitest**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"], testTimeout: 30000 },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 4: Scripts y env de ejemplo**

En `package.json` → `scripts` agregar:
```json
"test": "vitest run",
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx --env-file=.env.local src/db/migrate.ts",
"seed:admin": "tsx --env-file=.env.local scripts/seed-admin.ts",
"e2e": "playwright test"
```
`.env.example`:
```
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
SESSION_SECRET=cambia-esto-por-32-bytes-aleatorios-minimo
BLOB_READ_WRITE_TOKEN=
ADMIN_EMAIL=admin@offline.co
ADMIN_PASSWORD=cambia-esto
```

- [ ] **Step 5: Verificar que arranca y commit**

Run: `npm run build`  → Expected: build OK.
```bash
git add -A && git commit -m "chore: scaffold Next.js, tooling y dependencias"
```

---

### Task 2: Esquema de base de datos y arnés de pruebas

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `src/db/migrate.ts`, `drizzle.config.ts`, `tests/helpers/db.ts`, `tests/unit/schema.test.ts`

**Interfaces:**
- Produces: tablas y enums exportados de `schema.ts`; `type Db = PgDatabase<any, typeof schema>`; `getDb(): Db`; `makeTestDb(): Promise<Db>`; factories `seedProduct(db, opts)` → `{ productId, variantIds: number[] }`.

- [ ] **Step 1: Esquema**

`src/db/schema.ts`:
```ts
import { sql } from "drizzle-orm";
import {
  boolean, check, integer, pgEnum, pgSequence, pgTable, serial, text,
  timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

export const orderStatus = pgEnum("order_status", ["pending", "confirmed", "cancelled"]);
export const stockReason = pgEnum("stock_reason", ["order_confirmed", "order_cancelled", "manual"]);
export const orderCodeSeq = pgSequence("order_code_seq");

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  position: integer("position").notNull().default(0),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id),
  price: integer("price").notNull(),
  salePrice: integer("sale_price"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
});

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    colorName: text("color_name").notNull(),
    colorHex: text("color_hex").notNull().default("#000000"),
    stock: integer("stock").notNull().default(0),
    sku: text("sku"),
  },
  (t) => [
    uniqueIndex("variants_unique").on(t.productId, t.size, t.colorName),
    check("variants_stock_nonneg", sql`${t.stock} >= 0`),
  ],
);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  status: orderStatus("status").notNull().default("pending"),
  total: integer("total").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  size: text("size").notNull(),
  colorName: text("color_name").notNull(),
  unitPrice: integer("unit_price").notNull(),
  qty: integer("qty").notNull(),
});

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: stockReason("reason").notNull(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  whatsappNumber: text("whatsapp_number").notNull().default("3000000000"),
  storeName: text("store_name").notNull().default("OFFLINE"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Cliente y configuración de drizzle**

`src/db/client.ts`:
```ts
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<any, typeof schema>;

const g = globalThis as unknown as { __pool?: Pool };

export function getDb(): Db {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no definida");
  g.__pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return drizzle(g.__pool, { schema });
}
```
`drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```
`src/db/migrate.ts`:
```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
migrate(drizzle(pool), { migrationsFolder: "src/db/migrations" })
  .then(() => { console.log("migraciones aplicadas"); return pool.end(); })
  .catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Generar migración y verificar secuencia**

Run: `npm run db:generate`
Expected: archivo en `src/db/migrations/0000_*.sql`. Abrirlo y confirmar que contiene `CREATE SEQUENCE "public"."order_code_seq"` y el `CHECK ("variants"."stock" >= 0)`. Si falta la secuencia, agregar `CREATE SEQUENCE "order_code_seq";` a mano al inicio del SQL.

- [ ] **Step 4: Arnés de pruebas**

`tests/helpers/db.ts`:
```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { Db } from "@/db/client";

export async function makeTestDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  return db as unknown as Db;
}

export async function seedProduct(
  db: Db,
  o: {
    name?: string; price?: number; salePrice?: number | null; active?: boolean;
    variants?: { size: string; color: string; stock: number }[];
  } = {},
) {
  const name = o.name ?? "Camiseta Oversize";
  const [p] = await db.insert(schema.products).values({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`,
    price: o.price ?? 89900,
    salePrice: o.salePrice ?? null,
    active: o.active ?? true,
  }).returning();
  const vs = o.variants ?? [{ size: "M", color: "Negro", stock: 5 }];
  const rows = await db.insert(schema.variants).values(
    vs.map((v) => ({ productId: p.id, size: v.size, colorName: v.color, stock: v.stock })),
  ).returning();
  return { productId: p.id, variantIds: rows.map((r) => r.id) };
}
```

- [ ] **Step 5: Prueba de esquema (falla → pasa)**

`tests/unit/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeTestDb, seedProduct } from "../helpers/db";
import { variants } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("schema", () => {
  it("rechaza stock negativo", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db);
    await expect(
      db.update(variants).set({ stock: -1 }).where(eq(variants.id, variantIds[0])),
    ).rejects.toThrow();
  });

  it("rechaza variante duplicada (producto,talla,color)", async () => {
    const db = await makeTestDb();
    await expect(
      seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 1 }, { size: "M", color: "Negro", stock: 1 }] }),
    ).rejects.toThrow();
  });

  it("secuencia de códigos existe", async () => {
    const db = await makeTestDb();
    const r = await db.execute(`select nextval('order_code_seq') as n` as never);
    expect(Number((r as any).rows[0].n)).toBeGreaterThanOrEqual(1);
  });
});
```
Run: `npx vitest run tests/unit/schema.test.ts` → Expected: PASS (3). (Si `db.execute` con string falla por tipos, usar `sql\`select nextval('order_code_seq') as n\``.)

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat(db): esquema Drizzle, migración inicial y arnés PGlite"
```

---

### Task 3: Utilidades puras (dinero, teléfono, WhatsApp, validadores)

**Files:**
- Create: `src/lib/money.ts`, `src/lib/phone.ts`, `src/lib/whatsapp.ts`, `src/lib/validators.ts`, `tests/unit/lib.test.ts`

**Interfaces:**
- Produces:
  - `formatCop(n: number): string` → `"$89.900"`
  - `normalizePhone(raw: string): string | null` → 10 dígitos o `null`
  - `type MsgLine = { productName: string; size: string; colorName: string; qty: number; unitPrice: number }`
  - `buildOrderMessage(o: { code: string; name: string; lines: MsgLine[]; total: number }): string`
  - `buildWaUrl(storeNumber: string, text: string): string`
  - `buildCustomerChatUrl(phone: string): string`
  - `checkoutSchema` (zod): `{ name: string; phone: string; items: {variantId:number; qty:number}[] }`

- [ ] **Step 1: Pruebas que fallan**

`tests/unit/lib.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatCop } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { buildOrderMessage, buildWaUrl, buildCustomerChatUrl } from "@/lib/whatsapp";
import { checkoutSchema } from "@/lib/validators";

describe("formatCop", () => {
  it("formatea con puntos", () => {
    expect(formatCop(89900)).toBe("$89.900");
    expect(formatCop(1250000)).toBe("$1.250.000");
    expect(formatCop(0)).toBe("$0");
  });
});

describe("normalizePhone", () => {
  it("acepta formatos comunes", () => {
    expect(normalizePhone("3001234567")).toBe("3001234567");
    expect(normalizePhone("+57 300 123 4567")).toBe("3001234567");
    expect(normalizePhone("300-123-4567")).toBe("3001234567");
    expect(normalizePhone("573001234567")).toBe("3001234567");
  });
  it("rechaza inválidos", () => {
    expect(normalizePhone("300123456")).toBeNull();     // 9 dígitos
    expect(normalizePhone("30012345678")).toBeNull();   // 11 dígitos
    expect(normalizePhone("2001234567")).toBeNull();    // no inicia en 3
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("whatsapp", () => {
  const lines = [{ productName: "Camiseta Oversize", size: "M", colorName: "Negro", qty: 2, unitPrice: 89900 }];
  it("arma el mensaje", () => {
    const m = buildOrderMessage({ code: "OFF-0001", name: "Juan Pérez", lines, total: 179800 });
    expect(m).toContain("pedido OFF-0001");
    expect(m).toContain("Nombre: Juan Pérez");
    expect(m).toContain("• Camiseta Oversize - Negro / M x2 - $179.800");
    expect(m).toContain("Total productos: $179.800");
    expect(m).toContain("(envío por acordar)");
  });
  it("nombre con &, #, %, emoji y salto de línea llega íntegro y en una línea", () => {
    const m = buildOrderMessage({ code: "OFF-0002", name: "Ana & Co #1 100%\n😀", lines, total: 1 });
    expect(m.split("\n").filter((l) => l.startsWith("Nombre:"))).toHaveLength(1);
    const url = buildWaUrl("3001234567", m);
    const text = new URL(url).searchParams.get("text")!;
    expect(text).toBe(m);
    expect(url.startsWith("https://wa.me/573001234567?text=")).toBe(true);
  });
  it("chat del cliente", () => {
    expect(buildCustomerChatUrl("3001234567")).toBe("https://wa.me/573001234567");
  });
});

describe("checkoutSchema", () => {
  const ok = { name: "Juan", phone: "300 123 4567", items: [{ variantId: 1, qty: 2 }] };
  it("acepta válido y normaliza teléfono", () => {
    expect(checkoutSchema.parse(ok).phone).toBe("3001234567");
  });
  it.each([0, -1, 1.5, 100])("rechaza qty %s", (qty) => {
    expect(checkoutSchema.safeParse({ ...ok, items: [{ variantId: 1, qty }] }).success).toBe(false);
  });
  it("rechaza carrito vacío, nombre vacío y teléfono inválido", () => {
    expect(checkoutSchema.safeParse({ ...ok, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, name: "  " }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, phone: "123" }).success).toBe(false);
  });
});
```
Run: `npx vitest run tests/unit/lib.test.ts` → Expected: FAIL (módulos no existen).

- [ ] **Step 2: Implementación**

`src/lib/money.ts`:
```ts
export function formatCop(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}
```
`src/lib/phone.ts`:
```ts
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (!/^\d+$/.test(d)) return null;
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}
```
`src/lib/whatsapp.ts`:
```ts
import { formatCop } from "./money";

export type MsgLine = { productName: string; size: string; colorName: string; qty: number; unitPrice: number };

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

export function buildOrderMessage(o: { code: string; name: string; lines: MsgLine[]; total: number }): string {
  const lines = o.lines.map(
    (l) => `• ${oneLine(l.productName)} - ${oneLine(l.colorName)} / ${oneLine(l.size)} x${l.qty} - ${formatCop(l.unitPrice * l.qty)}`,
  );
  return [
    `Hola OFFLINE, quiero hacer el pedido ${o.code}`,
    `Nombre: ${oneLine(o.name)}`,
    ...lines,
    `Total productos: ${formatCop(o.total)}`,
    "(envío por acordar)",
  ].join("\n");
}

export function buildWaUrl(storeNumber: string, text: string): string {
  return `https://wa.me/57${storeNumber}?text=${encodeURIComponent(text)}`;
}

export function buildCustomerChatUrl(phone: string): string {
  return `https://wa.me/57${phone}`;
}
```
`src/lib/validators.ts`:
```ts
import { z } from "zod";
import { normalizePhone } from "./phone";

export const MAX_QTY_PER_LINE = 20;

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(80),
  phone: z
    .string()
    .transform((v, ctx) => {
      const n = normalizePhone(v);
      if (!n) ctx.addIssue({ code: "custom", message: "Celular colombiano de 10 dígitos (ej. 300 123 4567)" });
      return n ?? "";
    }),
  items: z
    .array(z.object({
      variantId: z.number().int().positive(),
      qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
    }))
    .min(1, "El carrito está vacío")
    .max(50),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(50),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).default(""),
  categoryId: z.coerce.number().int().positive().nullable(),
  price: z.coerce.number().int().min(1),
  salePrice: z.coerce.number().int().min(1).nullable(),
  active: z.boolean(),
}).refine((p) => p.salePrice === null || p.salePrice < p.price, {
  message: "La oferta debe ser menor al precio", path: ["salePrice"],
});

export const settingsSchema = z.object({
  whatsappNumber: z.string().transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Número inválido" });
    return n ?? "";
  }),
  storeName: z.string().trim().min(1).max(40),
  lowStockThreshold: z.coerce.number().int().min(0).max(100),
});
```

- [ ] **Step 3: Verificar y commit**

Run: `npx vitest run tests/unit/lib.test.ts` → Expected: PASS.
```bash
git add -A && git commit -m "feat(lib): dinero, teléfono, mensaje WhatsApp y validadores"
```

---

### Task 4: `createOrder`

**Files:**
- Create: `src/server/types.ts`, `src/server/orders.ts`, `tests/unit/orders.create.test.ts`

**Interfaces:**
- Consumes: `Db`, schema, `makeTestDb`, `seedProduct` (Task 2).
- Produces:
```ts
// types.ts
export type ItemIssue = { variantId: number; reason: "not_found" | "inactive" | "insufficient"; available: number };
export type OrderError =
  | { code: "invalid_items"; issues: ItemIssue[] }
  | { code: "invalid_state" }
  | { code: "not_found" }
  | { code: "variant_missing" }
  | { code: "insufficient_stock"; lines: { variantId: number; name: string; needed: number; available: number }[] };
export type Result<T> = { ok: true; data: T } | { ok: false; error: OrderError };
// orders.ts
export type CreatedOrder = { orderId: number; code: string; total: number; lines: MsgLine[] };
export function createOrder(db: Db, input: { name: string; phone: string; items: { variantId: number; qty: number }[] }): Promise<Result<CreatedOrder>>
```

- [ ] **Step 1: Pruebas que fallan**

`tests/unit/orders.create.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createOrder } from "@/server/orders";
import { orders, orderItems, variants } from "@/db/schema";

const who = { name: "Juan", phone: "3001234567" };

describe("createOrder", () => {
  it("crea pendiente, usa precio de oferta, snapshot y NO toca stock", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db, { price: 100000, salePrice: 80000, variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const r = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty: 2 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.code).toBe("OFF-0001");
    expect(r.data.total).toBe(160000);
    const [o] = await db.select().from(orders).where(eq(orders.id, r.data.orderId));
    expect(o.status).toBe("pending");
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    expect(items[0]).toMatchObject({ unitPrice: 80000, qty: 2, size: "M", colorName: "Negro" });
    const [v] = await db.select().from(variants).where(eq(variants.id, variantIds[0]));
    expect(v.stock).toBe(5);
  });

  it("códigos consecutivos", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db);
    const a = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty: 1 }] });
    const b = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty: 1 }] });
    expect(a.ok && a.data.code).toBe("OFF-0001");
    expect(b.ok && b.data.code).toBe("OFF-0002");
  });

  it("suma líneas repetidas de la misma variante antes de validar stock", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 3 }] });
    const r = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty: 2 }, { variantId: variantIds[0], qty: 2 }] });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.code === "invalid_items") {
      expect(r.error.issues[0]).toMatchObject({ variantId: variantIds[0], reason: "insufficient", available: 3 });
    }
    const ok = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty: 1 }, { variantId: variantIds[0], qty: 2 }] });
    expect(ok.ok && ok.data.lines).toHaveLength(1);
    expect(ok.ok && ok.data.lines[0].qty).toBe(3);
  });

  it("rechaza inactivo, inexistente y sin stock sin crear pedido", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { active: false });
    const b = await seedProduct(db, { variants: [{ size: "S", color: "Blanco", stock: 0 }] });
    const r = await createOrder(db, { ...who, items: [
      { variantId: a.variantIds[0], qty: 1 }, { variantId: 99999, qty: 1 }, { variantId: b.variantIds[0], qty: 1 },
    ] });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.code === "invalid_items") {
      expect(r.error.issues.map((i) => i.reason).sort()).toEqual(["inactive", "insufficient", "not_found"]);
    }
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it.each([0, -1, 1.5, 1e9])("rechaza qty inválida %s", async (qty) => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db);
    const r = await createOrder(db, { ...who, items: [{ variantId: variantIds[0], qty }] });
    expect(r.ok).toBe(false);
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it("carrito vacío falla", async () => {
    const db = await makeTestDb();
    expect((await createOrder(db, { ...who, items: [] })).ok).toBe(false);
  });
});
```
Run: `npx vitest run tests/unit/orders.create.test.ts` → Expected: FAIL (módulo no existe).

- [ ] **Step 2: Implementación**

`src/server/types.ts`: exactamente los tipos de **Interfaces** arriba.

`src/server/orders.ts` (por ahora solo `createOrder`; Task 5 agrega el resto):
```ts
import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orderItems, orders, products, variants } from "@/db/schema";
import type { MsgLine } from "@/lib/whatsapp";
import type { ItemIssue, Result } from "./types";

export type CreatedOrder = { orderId: number; code: string; total: number; lines: MsgLine[] };

export async function createOrder(
  db: Db,
  input: { name: string; phone: string; items: { variantId: number; qty: number }[] },
): Promise<Result<CreatedOrder>> {
  const merged = new Map<number, number>();
  for (const i of input.items) {
    if (!Number.isInteger(i.qty) || i.qty < 1 || i.qty > 1000) {
      return { ok: false, error: { code: "invalid_items", issues: [{ variantId: i.variantId, reason: "insufficient", available: 0 }] } };
    }
    merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.qty);
  }
  if (merged.size === 0) return { ok: false, error: { code: "invalid_items", issues: [] } };

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: variants.id, size: variants.size, colorName: variants.colorName, stock: variants.stock,
        name: products.name, price: products.price, salePrice: products.salePrice, active: products.active,
      })
      .from(variants)
      .innerJoin(products, eq(variants.productId, products.id))
      .where(inArray(variants.id, [...merged.keys()]));
    const byId = new Map(rows.map((r) => [r.id, r]));

    const issues: ItemIssue[] = [];
    for (const [variantId, qty] of merged) {
      const v = byId.get(variantId);
      if (!v) issues.push({ variantId, reason: "not_found", available: 0 });
      else if (!v.active) issues.push({ variantId, reason: "inactive", available: 0 });
      else if (qty > v.stock) issues.push({ variantId, reason: "insufficient", available: v.stock });
    }
    if (issues.length) return { ok: false as const, error: { code: "invalid_items" as const, issues } };

    const lines: MsgLine[] = [...merged].map(([variantId, qty]) => {
      const v = byId.get(variantId)!;
      return { productName: v.name, size: v.size, colorName: v.colorName, qty, unitPrice: v.salePrice ?? v.price };
    });
    const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

    const seq = await tx.execute(sql`select nextval('order_code_seq') as n`);
    const n = Number((seq as any).rows[0].n);
    const code = `OFF-${String(n).padStart(4, "0")}`;

    const [o] = await tx.insert(orders)
      .values({ code, customerName: input.name, customerPhone: input.phone, total })
      .returning({ id: orders.id });
    await tx.insert(orderItems).values(
      [...merged].map(([variantId, qty], idx) => ({
        orderId: o.id, variantId, productName: lines[idx].productName, size: lines[idx].size,
        colorName: lines[idx].colorName, unitPrice: lines[idx].unitPrice, qty,
      })),
    );
    return { ok: true as const, data: { orderId: o.id, code, total, lines } };
  });
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npx vitest run tests/unit/orders.create.test.ts` → Expected: PASS.
```bash
git add -A && git commit -m "feat(orders): createOrder con validación de stock sin reservar"
```

---

### Task 5: `confirmOrder`, `cancelOrder`, `adjustStock`

**Files:**
- Modify: `src/server/orders.ts`
- Create: `tests/unit/orders.state.test.ts`

**Interfaces:**
- Consumes: `createOrder`, tipos de Task 4.
- Produces:
```ts
confirmOrder(db: Db, orderId: number): Promise<Result<{ code: string }>>
cancelOrder(db: Db, orderId: number): Promise<Result<{ code: string; restocked: boolean }>>
adjustStock(db: Db, variantId: number, delta: number): Promise<Result<{ stock: number }>>   // reason "manual"
```

- [ ] **Step 1: Pruebas que fallan**

`tests/unit/orders.state.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createOrder, confirmOrder, cancelOrder, adjustStock } from "@/server/orders";
import { orders, variants, stockMovements } from "@/db/schema";

const who = { name: "Juan", phone: "3001234567" };
const stockOf = async (db: any, id: number) => (await db.select().from(variants).where(eq(variants.id, id)))[0].stock;
async function pending(db: any, variantId: number, qty: number) {
  const r = await createOrder(db, { ...who, items: [{ variantId, qty }] });
  if (!r.ok) throw new Error("setup");
  return r.data.orderId;
}

describe("confirmOrder", () => {
  it("descuenta stock, marca confirmed y registra movimiento", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const id = await pending(db, v, 2);
    const r = await confirmOrder(db, id);
    expect(r.ok).toBe(true);
    expect(await stockOf(db, v)).toBe(3);
    const [o] = await db.select().from(orders).where(eq(orders.id, id));
    expect(o.status).toBe("confirmed");
    expect(o.confirmedAt).not.toBeNull();
    const mv = await db.select().from(stockMovements);
    expect(mv).toMatchObject([{ variantId: v, delta: -2, reason: "order_confirmed", orderId: id }]);
  });

  it("stock insuficiente aborta TODO sin cambios parciales", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const b = await seedProduct(db, { name: "Hoodie", variants: [{ size: "L", color: "Gris", stock: 2 }] });
    const r1 = await createOrder(db, { ...who, items: [{ variantId: a.variantIds[0], qty: 3 }, { variantId: b.variantIds[0], qty: 2 }] });
    if (!r1.ok) throw new Error("setup");
    await adjustStock(db, b.variantIds[0], -1); // ahora b tiene 1
    const r = await confirmOrder(db, r1.data.orderId);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.code === "insufficient_stock") {
      expect(r.error.lines).toEqual([expect.objectContaining({ variantId: b.variantIds[0], needed: 2, available: 1 })]);
    }
    expect(await stockOf(db, a.variantIds[0])).toBe(5);
    expect(await stockOf(db, b.variantIds[0])).toBe(1);
    const [o] = await db.select().from(orders).where(eq(orders.id, r1.data.orderId));
    expect(o.status).toBe("pending");
  });

  it("doble confirmación no descuenta dos veces", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const id = await pending(db, v, 2);
    expect((await confirmOrder(db, id)).ok).toBe(true);
    const again = await confirmOrder(db, id);
    expect(again).toEqual({ ok: false, error: { code: "invalid_state" } });
    expect(await stockOf(db, v)).toBe(3);
  });

  it("dos pedidos por la última unidad: solo uno confirma", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 1 }] });
    const a = await pending(db, v, 1);
    const b = await pending(db, v, 1);
    const [ra, rb] = await Promise.all([confirmOrder(db, a), confirmOrder(db, b)]);
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1);
    expect(await stockOf(db, v)).toBe(0);
  });

  it("variante borrada → variant_missing sin cambios", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db);
    const id = await pending(db, v, 1);
    await db.delete(variants).where(eq(variants.id, v));
    const r = await confirmOrder(db, id);
    expect(r).toEqual({ ok: false, error: { code: "variant_missing" } });
    const [o] = await db.select().from(orders).where(eq(orders.id, id));
    expect(o.status).toBe("pending");
  });

  it("pedido inexistente → not_found", async () => {
    const db = await makeTestDb();
    expect(await confirmOrder(db, 12345)).toEqual({ ok: false, error: { code: "not_found" } });
  });
});

describe("cancelOrder", () => {
  it("pending → cancelled no toca stock", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const id = await pending(db, v, 2);
    const r = await cancelOrder(db, id);
    expect(r).toMatchObject({ ok: true, data: { restocked: false } });
    expect(await stockOf(db, v)).toBe(5);
  });

  it("confirmed → cancelled devuelve stock y registra movimiento", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const id = await pending(db, v, 2);
    await confirmOrder(db, id);
    const r = await cancelOrder(db, id);
    expect(r).toMatchObject({ ok: true, data: { restocked: true } });
    expect(await stockOf(db, v)).toBe(5);
    const mv = await db.select().from(stockMovements).where(eq(stockMovements.reason, "order_cancelled"));
    expect(mv).toMatchObject([{ delta: 2, orderId: id }]);
  });

  it("cancelled no se puede cancelar ni confirmar; no devuelve stock dos veces", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }] });
    const id = await pending(db, v, 2);
    await confirmOrder(db, id);
    await cancelOrder(db, id);
    expect(await cancelOrder(db, id)).toEqual({ ok: false, error: { code: "invalid_state" } });
    expect(await confirmOrder(db, id)).toEqual({ ok: false, error: { code: "invalid_state" } });
    expect(await stockOf(db, v)).toBe(5);
  });
});

describe("adjustStock", () => {
  it("suma/resta y registra; no permite bajar de 0", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 2 }] });
    expect(await adjustStock(db, v, 5)).toEqual({ ok: true, data: { stock: 7 } });
    const bad = await adjustStock(db, v, -10);
    expect(bad.ok).toBe(false);
    expect(await stockOf(db, v)).toBe(7);
    expect((await db.select().from(stockMovements).where(eq(stockMovements.reason, "manual")))).toHaveLength(1);
  });
});
```
Run: `npx vitest run tests/unit/orders.state.test.ts` → Expected: FAIL (funciones no exportadas).

- [ ] **Step 2: Implementación (agregar a `src/server/orders.ts`)**

Agregar imports `and, asc` de `drizzle-orm` y `stockMovements` del schema, luego:
```ts
export async function confirmOrder(db: Db, orderId: number): Promise<Result<{ code: string }>> {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) return { ok: false as const, error: { code: "not_found" as const } };
    if (o.status !== "pending") return { ok: false as const, error: { code: "invalid_state" as const } };

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    if (items.some((i) => i.variantId === null)) {
      return { ok: false as const, error: { code: "variant_missing" as const } };
    }
    const needed = new Map<number, number>();
    for (const i of items) needed.set(i.variantId!, (needed.get(i.variantId!) ?? 0) + i.qty);

    // bloqueo ordenado por id para evitar deadlocks entre confirmaciones concurrentes
    const locked = await tx
      .select({ id: variants.id, stock: variants.stock, size: variants.size, color: variants.colorName, name: products.name })
      .from(variants)
      .innerJoin(products, eq(variants.productId, products.id))
      .where(inArray(variants.id, [...needed.keys()]))
      .orderBy(asc(variants.id))
      .for("update", { of: variants });

    if (locked.length !== needed.size) return { ok: false as const, error: { code: "variant_missing" as const } };
    const short = locked
      .filter((v) => v.stock < needed.get(v.id)!)
      .map((v) => ({ variantId: v.id, name: `${v.name} ${v.color}/${v.size}`, needed: needed.get(v.id)!, available: v.stock }));
    if (short.length) return { ok: false as const, error: { code: "insufficient_stock" as const, lines: short } };

    for (const [variantId, qty] of needed) {
      await tx.update(variants).set({ stock: sql`${variants.stock} - ${qty}` }).where(eq(variants.id, variantId));
      await tx.insert(stockMovements).values({ variantId, delta: -qty, reason: "order_confirmed", orderId });
    }
    await tx.update(orders).set({ status: "confirmed", confirmedAt: new Date() }).where(eq(orders.id, orderId));
    return { ok: true as const, data: { code: o.code } };
  });
}

export async function cancelOrder(db: Db, orderId: number): Promise<Result<{ code: string; restocked: boolean }>> {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) return { ok: false as const, error: { code: "not_found" as const } };
    if (o.status === "cancelled") return { ok: false as const, error: { code: "invalid_state" as const } };

    let restocked = false;
    if (o.status === "confirmed") {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const back = new Map<number, number>();
      for (const i of items) if (i.variantId !== null) back.set(i.variantId, (back.get(i.variantId) ?? 0) + i.qty);
      const ids = [...back.keys()].sort((a, b) => a - b);
      if (ids.length) {
        await tx.select({ id: variants.id }).from(variants).where(inArray(variants.id, ids)).orderBy(asc(variants.id)).for("update");
      }
      for (const variantId of ids) {
        const qty = back.get(variantId)!;
        await tx.update(variants).set({ stock: sql`${variants.stock} + ${qty}` }).where(eq(variants.id, variantId));
        await tx.insert(stockMovements).values({ variantId, delta: qty, reason: "order_cancelled", orderId });
      }
      restocked = ids.length > 0;
    }
    await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, orderId));
    return { ok: true as const, data: { code: o.code, restocked } };
  });
}

export async function adjustStock(db: Db, variantId: number, delta: number): Promise<Result<{ stock: number }>> {
  if (!Number.isInteger(delta) || delta === 0) return { ok: false, error: { code: "invalid_state" } };
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(variants).where(eq(variants.id, variantId)).for("update");
    if (!v) return { ok: false as const, error: { code: "not_found" as const } };
    const next = v.stock + delta;
    if (next < 0) {
      return { ok: false as const, error: { code: "insufficient_stock" as const, lines: [{ variantId, name: `${v.colorName}/${v.size}`, needed: -delta, available: v.stock }] } };
    }
    await tx.update(variants).set({ stock: next }).where(eq(variants.id, variantId));
    await tx.insert(stockMovements).values({ variantId, delta, reason: "manual", orderId: null });
    return { ok: true as const, data: { stock: next } };
  });
}
```
Nota: `.for("update", { of: variants })` es necesario porque el SELECT tiene JOIN; si la versión de Drizzle instalada no soporta `of`, separar en dos consultas (primero `select ... from variants for update`, luego el nombre del producto).

- [ ] **Step 3: Verificar y commit**

Run: `npx vitest run tests/unit` → Expected: todas PASS.
```bash
git add -A && git commit -m "feat(orders): confirmar/cancelar con stock transaccional y ajuste manual"
```

---

### Task 6: Rate limit y autenticación (capa server)

**Files:**
- Create: `src/server/ratelimit.ts`, `src/server/auth.ts`, `scripts/seed-admin.ts`, `tests/unit/ratelimit.test.ts`, `tests/unit/auth.test.ts`

**Interfaces:**
- Produces:
```ts
hit(db: Db, key: string, limit: number, windowSec: number): Promise<boolean>   // true = permitido
hashPassword(p: string): Promise<string>; verifyPassword(p: string, hash: string): Promise<boolean>
signSession(adminId: number): Promise<string>; readSession(token: string | undefined): Promise<{ adminId: number } | null>
createSession(adminId: number): Promise<void>   // setea cookie "offline_admin"
destroySession(): Promise<void>
requireAdmin(): Promise<{ adminId: number }>     // redirige a /admin/login si no hay sesión
loginAdmin(db: Db, email: string, password: string, ip: string): Promise<{ ok: true } | { ok: false; error: "rate_limited" | "invalid" }>
clientIp(): Promise<string>                        // lee x-forwarded-for
```

- [ ] **Step 1: Pruebas que fallan**

`tests/unit/ratelimit.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { hit } from "@/server/ratelimit";

describe("hit", () => {
  it("permite hasta el límite y luego bloquea", async () => {
    const db = await makeTestDb();
    const res = [];
    for (let i = 0; i < 5; i++) res.push(await hit(db, "ip:1", 3, 60));
    expect(res).toEqual([true, true, true, false, false]);
  });
  it("claves independientes", async () => {
    const db = await makeTestDb();
    await hit(db, "a", 1, 60);
    expect(await hit(db, "a", 1, 60)).toBe(false);
    expect(await hit(db, "b", 1, 60)).toBe(true);
  });
});
```
`tests/unit/auth.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { makeTestDb } from "../helpers/db";
import { hashPassword, verifyPassword, signSession, readSession, loginAdmin } from "@/server/auth";
import { adminUsers } from "@/db/schema";

beforeAll(() => { process.env.SESSION_SECRET = "x".repeat(40); });

describe("auth", () => {
  it("hash y verificación", async () => {
    const h = await hashPassword("secreto123");
    expect(await verifyPassword("secreto123", h)).toBe(true);
    expect(await verifyPassword("otra", h)).toBe(false);
  });
  it("sesión firmada ida y vuelta; token inválido → null", async () => {
    const t = await signSession(7);
    expect(await readSession(t)).toEqual({ adminId: 7 });
    expect(await readSession(t + "x")).toBeNull();
    expect(await readSession(undefined)).toBeNull();
  });
  it("loginAdmin ok, inválido y bloqueo por intentos", async () => {
    const db = await makeTestDb();
    await db.insert(adminUsers).values({ email: "a@b.co", passwordHash: await hashPassword("pass12345") });
    expect(await loginAdmin(db, "a@b.co", "pass12345", "1.1.1.1")).toEqual({ ok: true, adminId: expect.any(Number) });
    expect(await loginAdmin(db, "a@b.co", "mala", "2.2.2.2")).toEqual({ ok: false, error: "invalid" });
    for (let i = 0; i < 6; i++) await loginAdmin(db, "a@b.co", "mala", "3.3.3.3");
    expect(await loginAdmin(db, "a@b.co", "pass12345", "3.3.3.3")).toEqual({ ok: false, error: "rate_limited" });
  });
});
```
Run → Expected: FAIL.

- [ ] **Step 2: Implementación**

`src/server/ratelimit.ts`:
```ts
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";

export async function hit(db: Db, key: string, limit: number, windowSec: number): Promise<boolean> {
  const r = await db.execute(sql`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
    returning count`);
  return Number((r as any).rows[0].count) <= limit;
}
```
`src/server/auth.ts`:
```ts
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { adminUsers } from "@/db/schema";
import { hit } from "./ratelimit";

const COOKIE = "offline_admin";
const MAX_AGE = 60 * 60 * 24 * 7;
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function signSession(adminId: number) {
  return new SignJWT({ adminId }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(`${MAX_AGE}s`).sign(secret());
}
export async function readSession(token: string | undefined): Promise<{ adminId: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.adminId === "number" ? { adminId: payload.adminId } : null;
  } catch { return null; }
}
export async function createSession(adminId: number) {
  (await cookies()).set(COOKIE, await signSession(adminId), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }
export async function requireAdmin() {
  const s = await readSession((await cookies()).get(COOKIE)?.value);
  if (!s) redirect("/admin/login");
  return s;
}
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

export async function loginAdmin(db: Db, email: string, password: string, ip: string) {
  if (!(await hit(db, `login:${ip}`, 5, 15 * 60))) return { ok: false as const, error: "rate_limited" as const };
  const [u] = await db.select().from(adminUsers).where(eq(adminUsers.email, email.trim().toLowerCase()));
  if (!u || !(await verifyPassword(password, u.passwordHash))) return { ok: false as const, error: "invalid" as const };
  return { ok: true as const, adminId: u.id };
}
```
`src/middleware.ts` (defensa adicional; las Server Actions igual llaman `requireAdmin`):
```ts
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  const token = req.cookies.get("offline_admin")?.value;
  try {
    if (!token) throw new Error();
    await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET ?? ""));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}
export const config = { matcher: ["/admin/:path*"] };
```
`scripts/seed-admin.ts`:
```ts
import { getDb } from "../src/db/client";
import { adminUsers, settings } from "../src/db/schema";
import { hashPassword } from "../src/server/auth";

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ADMIN_EMAIL y ADMIN_PASSWORD requeridas");
  const db = getDb();
  await db.insert(adminUsers).values({ email, passwordHash: await hashPassword(password) })
    .onConflictDoUpdate({ target: adminUsers.email, set: { passwordHash: await hashPassword(password) } });
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  console.log("admin listo:", email);
  process.exit(0);
}
main();
```
Nota: `src/server/auth.ts` importa `next/headers`; en los tests unitarios solo se usan funciones que no llaman `cookies()`. Si Vitest falla al resolver `next/headers`, agregar en `vitest.config.ts` `test.alias: { "next/headers": path.resolve(__dirname, "tests/helpers/next-stub.ts"), "next/navigation": same }` con un stub que exporte `cookies`, `headers`, `redirect` vacíos.

- [ ] **Step 3: Verificar y commit**

Run: `npx vitest run tests/unit` → Expected: PASS.
```bash
git add -A && git commit -m "feat(auth): rate limit atómico, sesión JWT, login y seed de admin"
```

---

### Task 7: Shell de admin: login, layout y ajustes

**Files:**
- Create: `src/app/admin/login/page.tsx`, `src/app/admin/login/actions.ts`, `src/app/admin/layout.tsx`, `src/components/admin/Nav.tsx`, `src/app/admin/ajustes/page.tsx`, `src/app/admin/ajustes/actions.ts`, `src/server/settings.ts`

**Interfaces:**
- Consumes: `loginAdmin`, `createSession`, `destroySession`, `requireAdmin`, `clientIp`, `settingsSchema`.
- Produces: `getSettings(db: Db): Promise<{ whatsappNumber: string; storeName: string; lowStockThreshold: number }>` (crea la fila `id=1` si no existe).

- [ ] **Step 1: `src/server/settings.ts`**
```ts
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { settings } from "@/db/schema";

export async function getSettings(db: Db) {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  return { whatsappNumber: s.whatsappNumber, storeName: s.storeName, lowStockThreshold: s.lowStockThreshold };
}
```

- [ ] **Step 2: Login**

`src/app/admin/login/actions.ts`:
```ts
"use server";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { clientIp, createSession, loginAdmin } from "@/server/auth";

export async function loginAction(_: { error?: string } | undefined, fd: FormData) {
  const r = await loginAdmin(getDb(), String(fd.get("email") ?? ""), String(fd.get("password") ?? ""), await clientIp());
  if (!r.ok) return { error: r.error === "rate_limited" ? "Demasiados intentos. Espera 15 minutos." : "Credenciales inválidas" };
  await createSession(r.adminId);
  redirect("/admin");
}
```
`src/app/admin/login/page.tsx` (client component con `useActionState(loginAction, undefined)`): formulario con campos `email` y `password` (`type="password"`), botón "Entrar" (`pending` deshabilita), y `<p role="alert">` con `state?.error`. Usa `Input`, `Button`, `Label` de shadcn, centrado en pantalla.

- [ ] **Step 3: Layout protegido y navegación**

`src/app/admin/layout.tsx` (server component): el login queda fuera porque su ruta está en `/admin/login` y el layout no fuerza sesión por sí mismo; en su lugar, cada `page.tsx` protegida llama `await requireAdmin()` y el middleware ya redirige. El layout solo renderiza `<Nav />` cuando hay cookie:
```tsx
import { cookies } from "next/headers";
import { readSession } from "@/server/auth";
import { Nav } from "@/components/admin/Nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await readSession((await cookies()).get("offline_admin")?.value);
  return (
    <div className="min-h-screen bg-neutral-50">
      {s && <Nav />}
      <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
    </div>
  );
}
```
`src/components/admin/Nav.tsx`: barra con enlaces `/admin` (Dashboard), `/admin/pedidos`, `/admin/productos`, `/admin/categorias`, `/admin/ajustes`, y un `<form action={logoutAction}>` con botón "Salir". `logoutAction` (en `src/app/admin/login/actions.ts`): `"use server"; destroySession(); redirect("/admin/login")`.

- [ ] **Step 4: Ajustes**

`src/app/admin/ajustes/actions.ts`:
```ts
"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { adminUsers, settings } from "@/db/schema";
import { hashPassword, requireAdmin, verifyPassword } from "@/server/auth";
import { settingsSchema } from "@/lib/validators";

export async function saveSettings(_: unknown, fd: FormData) {
  await requireAdmin();
  const p = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  await getDb().update(settings).set(p.data).where(eq(settings.id, 1));
  revalidatePath("/", "layout");
  return { ok: "Guardado" };
}

export async function changePassword(_: unknown, fd: FormData) {
  const { adminId } = await requireAdmin();
  const current = String(fd.get("current") ?? ""), next = String(fd.get("next") ?? "");
  if (next.length < 10) return { error: "La nueva contraseña debe tener al menos 10 caracteres" };
  const db = getDb();
  const [u] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId));
  if (!(await verifyPassword(current, u.passwordHash))) return { error: "Contraseña actual incorrecta" };
  await db.update(adminUsers).set({ passwordHash: await hashPassword(next) }).where(eq(adminUsers.id, adminId));
  return { ok: "Contraseña actualizada" };
}
```
`page.tsx`: llama `requireAdmin()`, carga `getSettings`, y muestra dos formularios (client, `useActionState`): ajustes (`whatsappNumber`, `storeName`, `lowStockThreshold`) y cambio de contraseña (`current`, `next`).

- [ ] **Step 5: Verificación manual y commit**

```bash
cp .env.example .env.local   # completar DATABASE_URL (Neon o Postgres local) y SESSION_SECRET
npm run db:migrate && npm run seed:admin && npm run dev
```
Abrir `/admin` sin sesión → redirige a `/admin/login`; credenciales malas → mensaje; buenas → `/admin`; `/admin/ajustes` guarda el número.
```bash
git add -A && git commit -m "feat(admin): login, layout protegido y ajustes"
```

---

### Task 8: Catálogo (consultas) y categorías

**Files:**
- Create: `src/server/catalog.ts`, `src/app/admin/categorias/page.tsx`, `src/app/admin/categorias/actions.ts`, `tests/unit/catalog.test.ts`, `src/lib/slug.ts`

**Interfaces:**
- Consumes: schema, `seedProduct`.
- Produces:
```ts
slugify(s: string): string
type CatalogFilters = { category?: string; size?: string; color?: string; min?: number; max?: number; sale?: boolean; q?: string; sort?: "new" | "price_asc" | "price_desc" }
type ProductCard = { id: number; slug: string; name: string; price: number; salePrice: number | null; image: string | null; inStock: boolean }
listProducts(db: Db, f: CatalogFilters): Promise<ProductCard[]>          // solo activos
getProductBySlug(db: Db, slug: string): Promise<null | { id; slug; name; description; price; salePrice; categoryName: string | null; images: string[]; variants: { id: number; size: string; colorName: string; colorHex: string; stock: number }[] }>
getFilterOptions(db: Db): Promise<{ categories: {slug:string;name:string}[]; sizes: string[]; colors: {name:string;hex:string}[] }>
getCartLines(db: Db, ids: number[]): Promise<{ variantId: number; productName: string; slug: string; size: string; colorName: string; price: number; stock: number; image: string | null; active: boolean }[]>
```

- [ ] **Step 1: Pruebas que fallan**

`tests/unit/catalog.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeTestDb, seedProduct } from "../helpers/db";
import { listProducts, getProductBySlug, getCartLines } from "@/server/catalog";
import { slugify } from "@/lib/slug";
import { categories, products } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("slugify", () => {
  it("quita tildes y símbolos", () => expect(slugify("Camiseta Básica Ñandú!")).toBe("camiseta-basica-nandu"));
});

describe("listProducts", () => {
  it("oculta inactivos y marca agotados", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "Activo" });
    await seedProduct(db, { name: "Oculto", active: false });
    await seedProduct(db, { name: "Agotado", variants: [{ size: "M", color: "Negro", stock: 0 }] });
    const r = await listProducts(db, {});
    expect(r.map((p) => p.name).sort()).toEqual(["Activo", "Agotado"]);
    expect(r.find((p) => p.name === "Agotado")!.inStock).toBe(false);
  });

  it("filtra por talla, color, oferta, rango de precio y búsqueda", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "Hoodie Negro", price: 150000, variants: [{ size: "L", color: "Negro", stock: 2 }] });
    await seedProduct(db, { name: "Camiseta Blanca", price: 60000, salePrice: 50000, variants: [{ size: "M", color: "Blanco", stock: 2 }] });
    expect((await listProducts(db, { size: "L" })).map((p) => p.name)).toEqual(["Hoodie Negro"]);
    expect((await listProducts(db, { color: "Blanco" })).map((p) => p.name)).toEqual(["Camiseta Blanca"]);
    expect((await listProducts(db, { sale: true })).map((p) => p.name)).toEqual(["Camiseta Blanca"]);
    expect((await listProducts(db, { min: 100000 })).map((p) => p.name)).toEqual(["Hoodie Negro"]);
    expect((await listProducts(db, { q: "hood" })).map((p) => p.name)).toEqual(["Hoodie Negro"]);
  });

  it("filtra por categoría (slug)", async () => {
    const db = await makeTestDb();
    const [c] = await db.insert(categories).values({ name: "Hoodies", slug: "hoodies" }).returning();
    const { productId } = await seedProduct(db, { name: "H1" });
    await seedProduct(db, { name: "Otro" });
    await db.update(products).set({ categoryId: c.id }).where(eq(products.id, productId));
    expect((await listProducts(db, { category: "hoodies" })).map((p) => p.name)).toEqual(["H1"]);
  });

  it("ordena por precio efectivo", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "A", price: 100000, salePrice: 40000 });
    await seedProduct(db, { name: "B", price: 70000 });
    expect((await listProducts(db, { sort: "price_asc" })).map((p) => p.name)).toEqual(["A", "B"]);
  });
});

describe("getProductBySlug / getCartLines", () => {
  it("devuelve null para inactivo o inexistente", async () => {
    const db = await makeTestDb();
    const { productId } = await seedProduct(db, { name: "X", active: false });
    const [p] = await db.select().from(products).where(eq(products.id, productId));
    expect(await getProductBySlug(db, p.slug)).toBeNull();
    expect(await getProductBySlug(db, "no-existe")).toBeNull();
  });
  it("getCartLines usa precio efectivo y reporta active/stock", async () => {
    const db = await makeTestDb();
    const { variantIds } = await seedProduct(db, { price: 100, salePrice: 80, variants: [{ size: "M", color: "Negro", stock: 4 }] });
    const [l] = await getCartLines(db, variantIds);
    expect(l).toMatchObject({ price: 80, stock: 4, active: true, size: "M", colorName: "Negro" });
  });
});
```
Run → Expected: FAIL.

- [ ] **Step 2: Implementación**

`src/lib/slug.ts`:
```ts
export function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
```
`src/server/catalog.ts` — implementar con Drizzle:
- `listProducts`: `select` de `products` con `leftJoin categories`, `where active = true` + condiciones dinámicas (`and(...)`):
  - `category`: `categories.slug = f.category`
  - `size`/`color`: `exists(select 1 from variants where variants.product_id = products.id and size = ... [and stock > 0])` (usar `sql` con `exists`)
  - `min`/`max`: sobre `coalesce(products.sale_price, products.price)`
  - `sale`: `products.sale_price is not null`
  - `q`: `products.name ilike %q%`
  - `sort`: `new` → `created_at desc` (default), `price_asc/desc` → `coalesce(sale_price, price)`
  - `image`: subconsulta `(select url from product_images where product_id = products.id order by position asc limit 1)`
  - `inStock`: `exists(select 1 from variants where product_id = products.id and stock > 0)`
- `getProductBySlug`: producto activo + imágenes ordenadas + variantes ordenadas (`size`, `color_name`); `null` si no existe o `active=false`.
- `getFilterOptions`: categorías por `position`, tallas y colores distintos de variantes de productos activos.
- `getCartLines`: por `inArray(variants.id, ids)`, precio `coalesce(sale_price, price)`, `active` del producto, primera imagen. Si `ids` está vacío devuelve `[]` sin consultar.

- [ ] **Step 3: Categorías admin**

`src/app/admin/categorias/actions.ts`:
```ts
"use server";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "@/db/client";
import { categories, products } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { categorySchema } from "@/lib/validators";
import { slugify } from "@/lib/slug";

export async function createCategory(_: unknown, fd: FormData) {
  await requireAdmin();
  const p = categorySchema.safeParse({ name: fd.get("name") });
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    await getDb().insert(categories).values({ name: p.data.name, slug: slugify(p.data.name) });
  } catch { return { error: "Ya existe una categoría con ese nombre" }; }
  revalidateTag("catalog"); revalidatePath("/admin/categorias");
  return { ok: "Creada" };
}

export async function deleteCategory(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const db = getDb();
  await db.update(products).set({ categoryId: null }).where(eq(products.categoryId, id));
  await db.delete(categories).where(eq(categories.id, id));
  revalidateTag("catalog"); revalidatePath("/admin/categorias");
}
```
`page.tsx`: `requireAdmin()`, lista de categorías (nombre, # productos) con botón eliminar (`<form action={deleteCategory}>` con hidden `id`), y formulario de creación (client, `useActionState`).

- [ ] **Step 4: Verificar y commit**

Run: `npx vitest run tests/unit` → Expected: PASS.
```bash
git add -A && git commit -m "feat(catalog): consultas públicas con filtros y CRUD de categorías"
```

---

### Task 9: Admin de productos (datos, fotos, variantes)

**Files:**
- Create: `src/app/admin/productos/page.tsx`, `src/app/admin/productos/nuevo/page.tsx`, `src/app/admin/productos/[id]/page.tsx`, `src/app/admin/productos/actions.ts`, `src/components/admin/ProductForm.tsx`, `src/components/admin/VariantGrid.tsx`, `src/components/admin/ImageManager.tsx`, `src/app/api/admin/upload/route.ts`, `src/server/products.ts`, `tests/unit/products.test.ts`

**Interfaces:**
- Consumes: `productSchema`, `slugify`, `adjustStock`, `requireAdmin`, `readSession`.
- Produces (en `src/server/products.ts`):
```ts
createProduct(db: Db, data: { name: string; description: string; categoryId: number | null; price: number; salePrice: number | null; active: boolean }): Promise<{ id: number; slug: string }>
updateProduct(db: Db, id: number, data: same): Promise<void>            // no cambia el slug
generateVariants(db: Db, productId: number, sizes: string[], colors: { name: string; hex: string }[]): Promise<number>  // crea combinaciones faltantes (stock 0), devuelve # creadas
removeVariant(db: Db, variantId: number): Promise<"deleted" | "zeroed">  // zeroed si tiene order_items
addImage(db: Db, productId: number, url: string): Promise<void>
removeImage(db: Db, imageId: number): Promise<void>
moveImage(db: Db, imageId: number, dir: "up" | "down"): Promise<void>
```

- [ ] **Step 1: Pruebas que fallan**

`tests/unit/products.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createProduct, generateVariants, removeVariant, addImage, moveImage } from "@/server/products";
import { createOrder } from "@/server/orders";
import { variants, productImages } from "@/db/schema";

const base = { name: "Hoodie Basic", description: "", categoryId: null, price: 150000, salePrice: null, active: true };

describe("products", () => {
  it("createProduct genera slug único", async () => {
    const db = await makeTestDb();
    const a = await createProduct(db, base);
    const b = await createProduct(db, base);
    expect(a.slug).toBe("hoodie-basic");
    expect(b.slug).toBe("hoodie-basic-2");
  });

  it("generateVariants crea solo las combinaciones faltantes", async () => {
    const db = await makeTestDb();
    const { id } = await createProduct(db, base);
    expect(await generateVariants(db, id, ["S", "M"], [{ name: "Negro", hex: "#000000" }])).toBe(2);
    expect(await generateVariants(db, id, ["S", "M", "L"], [{ name: "Negro", hex: "#000000" }])).toBe(1);
    expect(await db.select().from(variants).where(eq(variants.productId, id))).toHaveLength(3);
  });

  it("removeVariant borra si no tiene ventas y pone stock 0 si las tiene", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 5 }, { size: "L", color: "Negro", stock: 5 }] });
    const r = await createOrder(db, { name: "Juan", phone: "3001234567", items: [{ variantId: a.variantIds[0], qty: 1 }] });
    expect(r.ok).toBe(true);
    expect(await removeVariant(db, a.variantIds[0])).toBe("zeroed");
    expect(await removeVariant(db, a.variantIds[1])).toBe("deleted");
    const [v] = await db.select().from(variants).where(eq(variants.id, a.variantIds[0]));
    expect(v.stock).toBe(0);
  });

  it("imágenes se ordenan y moveImage intercambia posiciones", async () => {
    const db = await makeTestDb();
    const { id } = await createProduct(db, base);
    await addImage(db, id, "a.jpg"); await addImage(db, id, "b.jpg");
    let imgs = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.position);
    expect(imgs.map((i) => i.url)).toEqual(["a.jpg", "b.jpg"]);
    await moveImage(db, imgs[1].id, "up");
    imgs = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.position);
    expect(imgs.map((i) => i.url)).toEqual(["b.jpg", "a.jpg"]);
  });
});
```
Run → Expected: FAIL.

- [ ] **Step 2: Implementar `src/server/products.ts`**

- `createProduct`: slug base `slugify(name)`; si existe, probar `-2`, `-3`… (consultar slugs `like base%`).
- `updateProduct`: `update products set ...` sin tocar slug.
- `generateVariants`: para cada `(size, color)` insertar con `onConflictDoNothing()` sobre el índice único; contar filas realmente insertadas con `.returning({id})`.
- `removeVariant`: `select count(*) from order_items where variant_id = $1`; si > 0 → `update variants set stock = 0` y registrar movimiento `manual` por el stock descontado (solo si stock > 0) y devolver `"zeroed"`; si 0 → `delete` y `"deleted"`.
- `addImage`: `position = coalesce(max(position), -1) + 1`.
- `removeImage`: borra fila (el blob queda; aceptable en v1, no se borra del Blob).
- `moveImage`: obtener imágenes del mismo producto ordenadas, intercambiar `position` con el vecino en la transacción; si no hay vecino no hace nada.

- [ ] **Step 3: Server Actions**

`src/app/admin/productos/actions.ts` (`"use server"`, todas inician con `await requireAdmin()` y terminan con `revalidateTag("catalog")` + `revalidatePath("/admin/productos")`):
- `saveProduct(id: number | null, _: unknown, fd: FormData)`: parsea con `productSchema` (`active` = `fd.get("active") === "on"`; `salePrice`/`categoryId` vacío → `null`); si `id` null → `createProduct` y `redirect(\`/admin/productos/${id}\`)`; si no → `updateProduct` y devuelve `{ ok: "Guardado" }`.
- `generateVariantsAction(productId, _, fd)`: `sizes` = checkboxes (`size`), más campo libre `extraSizes` separado por comas; `colors` = textarea `nombre:#hex` por línea (hex opcional, default `#000000`). Llama `generateVariants`.
- `setStockAction(variantId, fd)`: campo `delta` entero → `adjustStock`; si falla por insuficiente devuelve error.
- `removeVariantAction(fd)`, `removeImageAction(fd)`, `moveImageAction(fd)`, `toggleActive(fd)` (desde la lista).

- [ ] **Step 4: Subida a Vercel Blob**

`src/app/api/admin/upload/route.ts`:
```ts
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { readSession } from "@/server/auth";
import { addImage } from "@/server/products";

const MAX = 4 * 1024 * 1024;
const OK = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  if (!(await readSession((await cookies()).get("offline_admin")?.value))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const fd = await req.formData();
  const productId = Number(fd.get("productId"));
  const files = fd.getAll("files").filter((f): f is File => f instanceof File);
  if (!productId || files.length === 0) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  for (const f of files) {
    if (!OK.has(f.type)) return NextResponse.json({ error: `${f.name}: solo jpg, png o webp` }, { status: 400 });
    if (f.size > MAX) return NextResponse.json({ error: `${f.name}: máximo 4 MB` }, { status: 400 });
  }
  const db = getDb();
  for (const f of files) {
    const blob = await put(`products/${productId}/${Date.now()}-${f.name}`, f, { access: "public", addRandomSuffix: true });
    await addImage(db, productId, blob.url);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: UI**

- `productos/page.tsx`: `requireAdmin()`, tabla (foto, nombre, categoría, precio, stock total, activo) con búsqueda `?q=`, botón "Nuevo producto", interruptor activar/ocultar (`toggleActive`).
- `ProductForm` (client, `useActionState`): nombre, descripción, categoría (`select`), precio, precio de oferta, checkbox activo. `nuevo/page.tsx` lo usa con `id=null`; `[id]/page.tsx` lo usa con datos y debajo monta `ImageManager` y `VariantGrid`.
- `ImageManager` (client): `<input type="file" multiple accept="image/jpeg,image/png,image/webp">` → `fetch("/api/admin/upload", {method:"POST", body})` con `productId`, luego `router.refresh()`; muestra el error de la respuesta; miniaturas con botones ← → (moveImage) y eliminar; la primera marcada "Principal".
- `VariantGrid`: formulario "Generar combinaciones" (checkboxes XS S M L XL XXL + campo extra, textarea de colores) y tabla de variantes con color (muestra `colorHex`), talla, stock actual, campo `delta` con botones `-`/`+` (envía `setStockAction`) y botón eliminar (`removeVariantAction`). Resalta en rojo stock ≤ umbral.

- [ ] **Step 6: Verificar y commit**

Run: `npx vitest run tests/unit` → PASS. Manual: crear producto → generar variantes → subir 2 fotos (requiere `BLOB_READ_WRITE_TOKEN`) → ajustar stock → ocultar.
```bash
git add -A && git commit -m "feat(admin): productos con fotos en Blob y grilla de variantes"
```

---

### Task 10: Tienda pública: home, catálogo y producto

**Files:**
- Create: `src/app/(store)/layout.tsx`, `src/app/(store)/page.tsx`, `src/app/(store)/tienda/page.tsx`, `src/app/(store)/producto/[slug]/page.tsx`, `src/components/store/{Header,Footer,ProductCard,Filters,VariantPicker}.tsx`, `src/server/cached.ts`
- Modify: `src/app/layout.tsx` (fuentes, metadata), `src/app/globals.css` (tokens)

**Interfaces:**
- Consumes: `listProducts`, `getProductBySlug`, `getFilterOptions`, `getSettings`, `formatCop`.
- Produces: `cachedCatalog` helpers con `unstable_cache(..., { tags: ["catalog"] })`: `cachedList(f)`, `cachedProduct(slug)`, `cachedFilters()`. Tag `"catalog"` se invalida desde admin (Task 9) y al confirmar/cancelar (Task 12). `addToCart(item: {variantId:number; qty:number})` del store de carrito (Task 11) se importa en `VariantPicker`.

- [ ] **Step 1: Dirección visual**

Antes de escribir componentes, invocar la skill `frontend-design` y fijar (guardar en `src/app/globals.css` como variables CSS): minimalismo monocromo de marca de ropa; fondo `#fafaf7`, texto `#111`, acento único negro; titulares en fuente display con tracking amplio (p. ej. `Space Grotesk` o `Archivo` vía `next/font/google`), cuerpo `Inter`; imágenes de producto 4:5 a sangre, sin bordes redondeados salvo botones; mobile-first con grilla 2 columnas en móvil y 4 en escritorio. Logotipo textual "OFFLINE" en mayúsculas.

- [ ] **Step 2: Caché**

`src/server/cached.ts`:
```ts
import { unstable_cache } from "next/cache";
import { getDb } from "@/db/client";
import { getFilterOptions, getProductBySlug, listProducts, type CatalogFilters } from "./catalog";

export const cachedList = (f: CatalogFilters) =>
  unstable_cache(() => listProducts(getDb(), f), ["list", JSON.stringify(f)], { tags: ["catalog"], revalidate: 300 })();
export const cachedProduct = (slug: string) =>
  unstable_cache(() => getProductBySlug(getDb(), slug), ["product", slug], { tags: ["catalog"], revalidate: 300 })();
export const cachedFilters = () =>
  unstable_cache(() => getFilterOptions(getDb()), ["filters"], { tags: ["catalog"], revalidate: 300 })();
```

- [ ] **Step 3: Páginas**

- `(store)/layout.tsx`: `Header` (logo, enlaces Tienda, icono carrito con contador que lee el store de Task 11), `Footer` (nombre tienda, enlace "Escríbenos por WhatsApp" con `buildCustomerChatUrl`-equivalente al número de la tienda desde `getSettings`).
- `(store)/page.tsx`: hero con titular y botón "Ver tienda", fila de categorías (`cachedFilters().categories`), grilla "Novedades" con `cachedList({ sort: "new" })` limitada a 8.
- `(store)/tienda/page.tsx`: lee `searchParams` (`category,size,color,min,max,sale,q,sort`), parsea números con `Number.isFinite` (valores inválidos se ignoran), renderiza `Filters` (formulario GET que actualiza query params; sin JS extra) y la grilla de `ProductCard`. Estado vacío: "No hay productos con esos filtros" + enlace para limpiar.
- `ProductCard`: imagen (`next/image`, placeholder gris si no hay), nombre, precio; si hay oferta muestra precio tachado y `salePrice`; etiqueta "Agotado" si `!inStock`.
- `(store)/producto/[slug]/page.tsx`: `cachedProduct(slug)` → `notFound()` si `null`; galería (imagen principal + miniaturas), nombre, precio/oferta, descripción, `VariantPicker`. `generateMetadata` con título, descripción y `openGraph.images[0]`.
- `VariantPicker` (client): colores únicos como botones circulares (`colorHex`) con el nombre; al elegir color muestra las tallas de ese color, con las de `stock === 0` deshabilitadas y tachadas; cantidad (1…min(stock, 20)); botón "Agregar al carrito" deshabilitado hasta elegir color+talla; si toda la variante está agotada muestra "Agotado". Al agregar llama `addToCart` (Task 11) y abre el drawer/lleva al carrito.

- [ ] **Step 4: Verificación y commit**

Manual con datos de prueba: filtrar por talla/color, abrir producto agotado, slug inexistente → 404, producto oculto → 404. Run: `npm run build` → OK.
```bash
git add -A && git commit -m "feat(store): home, catálogo con filtros y página de producto"
```

---

### Task 11: Carrito, checkout y página de pedido

**Files:**
- Create: `src/lib/cart.ts`, `src/components/store/CartProvider.tsx`, `src/app/(store)/carrito/page.tsx`, `src/app/(store)/carrito/actions.ts`, `src/app/(store)/checkout/page.tsx`, `src/app/(store)/checkout/actions.ts`, `src/app/(store)/pedido/[code]/page.tsx`, `tests/unit/cart.test.ts`
- Modify: `src/app/(store)/layout.tsx` (envolver con `CartProvider`)

**Interfaces:**
- Consumes: `getCartLines`, `createOrder`, `checkoutSchema`, `hit`, `clientIp`, `buildOrderMessage`, `buildWaUrl`, `getSettings`, `MAX_QTY_PER_LINE`.
- Produces:
```ts
// src/lib/cart.ts (puro, testeable)
type CartItem = { variantId: number; qty: number }
addItem(items: CartItem[], item: CartItem, maxStock: number): CartItem[]     // suma y topa en min(maxStock, 20)
setQty(items: CartItem[], variantId: number, qty: number, maxStock: number): CartItem[]  // qty<=0 elimina
removeItem(items: CartItem[], variantId: number): CartItem[]
parseStored(raw: string | null): CartItem[]   // tolera JSON corrupto / datos inválidos → []
// CartProvider: useCart(): { items: CartItem[]; count: number; add(item, maxStock): void; setQty(...): void; remove(id): void; clear(): void }
// actions: fetchCartLines(ids: number[]) → CartLine[]; placeOrder(input: unknown) → { ok: true; waUrl: string; code: string } | { ok: false; error: string; issues?: ItemIssue[] }
```

- [ ] **Step 1: Pruebas que fallan**

`tests/unit/cart.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { addItem, setQty, removeItem, parseStored } from "@/lib/cart";

describe("cart", () => {
  it("addItem suma la misma variante y topa en stock y en 20", () => {
    let c = addItem([], { variantId: 1, qty: 2 }, 3);
    c = addItem(c, { variantId: 1, qty: 5 }, 3);
    expect(c).toEqual([{ variantId: 1, qty: 3 }]);
    expect(addItem([], { variantId: 2, qty: 99 }, 100)).toEqual([{ variantId: 2, qty: 20 }]);
  });
  it("setQty<=0 elimina; topa en stock", () => {
    expect(setQty([{ variantId: 1, qty: 2 }], 1, 0, 5)).toEqual([]);
    expect(setQty([{ variantId: 1, qty: 2 }], 1, 9, 4)).toEqual([{ variantId: 1, qty: 4 }]);
  });
  it("removeItem", () => expect(removeItem([{ variantId: 1, qty: 1 }, { variantId: 2, qty: 1 }], 1)).toEqual([{ variantId: 2, qty: 1 }]));
  it("parseStored tolera basura", () => {
    expect(parseStored(null)).toEqual([]);
    expect(parseStored("{no json")).toEqual([]);
    expect(parseStored('[{"variantId":1,"qty":2},{"variantId":"x","qty":-1},null]')).toEqual([{ variantId: 1, qty: 2 }]);
  });
});
```
Run → Expected: FAIL.

- [ ] **Step 2: `src/lib/cart.ts`**
```ts
import { MAX_QTY_PER_LINE } from "./validators";

export type CartItem = { variantId: number; qty: number };
const cap = (qty: number, maxStock: number) => Math.max(0, Math.min(Math.floor(qty), maxStock, MAX_QTY_PER_LINE));

export function addItem(items: CartItem[], item: CartItem, maxStock: number): CartItem[] {
  const cur = items.find((i) => i.variantId === item.variantId);
  const qty = cap((cur?.qty ?? 0) + item.qty, maxStock);
  if (qty <= 0) return items.filter((i) => i.variantId !== item.variantId);
  return cur ? items.map((i) => (i.variantId === item.variantId ? { ...i, qty } : i)) : [...items, { variantId: item.variantId, qty }];
}
export function setQty(items: CartItem[], variantId: number, qty: number, maxStock: number): CartItem[] {
  const q = cap(qty, maxStock);
  return q <= 0 ? items.filter((i) => i.variantId !== variantId) : items.map((i) => (i.variantId === variantId ? { ...i, qty: q } : i));
}
export const removeItem = (items: CartItem[], variantId: number) => items.filter((i) => i.variantId !== variantId);

export function parseStored(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((i): i is CartItem =>
      i && Number.isInteger(i.variantId) && i.variantId > 0 && Number.isInteger(i.qty) && i.qty > 0);
  } catch { return []; }
}
```
Run: `npx vitest run tests/unit/cart.test.ts` → PASS.

- [ ] **Step 3: `CartProvider`**

Client context que hidrata desde `localStorage["offline_cart"]` con `parseStored` en un `useEffect` (evita mismatch de hidratación), persiste en cada cambio dentro de `try/catch`, y expone `useCart()` según **Interfaces**. Sincroniza entre pestañas con el evento `storage`.

- [ ] **Step 4: Carrito**

`carrito/actions.ts`: `"use server"` `fetchCartLines(ids: number[])` → valida `ids` (array de ≤50 enteros positivos) y devuelve `getCartLines(getDb(), ids)`.
`carrito/page.tsx` (client): al montar y cuando cambian los ids llama `fetchCartLines`; por cada línea muestra imagen, nombre, color/talla, precio, selector de cantidad (topado por `stock`), quitar. Reconciliación: si una línea está `!active` o `stock === 0` → se elimina del carrito y se muestra aviso "X ya no está disponible"; si `qty > stock` → se ajusta a `stock` y se avisa. Muestra subtotal ("Total productos") y nota "El envío se acuerda por WhatsApp". Botón "Continuar" a `/checkout` (deshabilitado si el carrito está vacío).

- [ ] **Step 5: Checkout y `placeOrder`**

`checkout/actions.ts`:
```ts
"use server";
import { getDb } from "@/db/client";
import { checkoutSchema } from "@/lib/validators";
import { buildOrderMessage, buildWaUrl } from "@/lib/whatsapp";
import { clientIp } from "@/server/auth";
import { createOrder } from "@/server/orders";
import { hit } from "@/server/ratelimit";
import { getSettings } from "@/server/settings";
import { revalidateTag } from "next/cache";

export async function placeOrder(input: unknown) {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const db = getDb();
  if (!(await hit(db, `order:${await clientIp()}`, 5, 10 * 60))) {
    return { ok: false as const, error: "Demasiados pedidos seguidos. Intenta en unos minutos." };
  }
  const r = await createOrder(db, parsed.data);
  if (!r.ok) {
    if (r.error.code === "invalid_items") {
      return { ok: false as const, error: "Algunos productos cambiaron de disponibilidad", issues: r.error.issues };
    }
    return { ok: false as const, error: "No pudimos crear el pedido" };
  }
  const s = await getSettings(db);
  const text = buildOrderMessage({ code: r.data.code, name: parsed.data.name, lines: r.data.lines, total: r.data.total });
  revalidateTag("orders");
  return { ok: true as const, code: r.data.code, waUrl: buildWaUrl(s.whatsappNumber, text) };
}
```
`checkout/page.tsx` (client): campos `name` y `phone` (validación inline con `checkoutSchema.shape`), resumen de ítems desde `fetchCartLines`, botón "Pedir por WhatsApp" que llama `placeOrder({ name, phone, items })`; en éxito guarda `code` en `sessionStorage`, `clear()` del carrito, y `window.location.href = waUrl` (con `router.push(\`/pedido/${code}\`)` inmediatamente antes usando `window.open(waUrl, "_blank")` cuando el navegador lo permita; si `window.open` devuelve `null`, navegar a `waUrl` directo). En error con `issues`, recarga líneas del carrito y muestra qué ítems fallaron. Deshabilita el botón mientras está en vuelo (evita doble pedido).

- [ ] **Step 6: Página de confirmación**

`pedido/[code]/page.tsx` (server): busca el pedido por `code` (`notFound()` si no existe); muestra código, nombre, ítems, total, estado traducido (Pendiente / Confirmado / Cancelado) y botón "Abrir WhatsApp de nuevo" reconstruyendo el mensaje con `buildOrderMessage` desde `order_items`. No expone teléfono completo (solo últimos 4 dígitos).

- [ ] **Step 7: Verificación y commit**

Manual: agregar al carrito, recargar (persiste), bajar stock desde admin y reabrir carrito (se ajusta), pedir → pedido `pending` en BD, WhatsApp se abre con el mensaje; 6 pedidos seguidos desde la misma IP → bloqueo.
```bash
git add -A && git commit -m "feat(store): carrito local, checkout y pedido por WhatsApp"
```

---

### Task 12: Admin de pedidos

**Files:**
- Create: `src/server/orders-query.ts`, `src/app/admin/pedidos/page.tsx`, `src/app/admin/pedidos/[id]/page.tsx`, `src/app/admin/pedidos/actions.ts`, `src/components/admin/OrderActions.tsx`, `tests/unit/orders-query.test.ts`

**Interfaces:**
- Consumes: `confirmOrder`, `cancelOrder`, `buildCustomerChatUrl`, `formatCop`, `requireAdmin`.
- Produces:
```ts
listOrders(db: Db, f: { status?: "pending"|"confirmed"|"cancelled"; from?: Date; to?: Date; q?: string; page?: number }): Promise<{ rows: { id: number; code: string; customerName: string; customerPhone: string; status: string; total: number; createdAt: Date }[]; total: number }>  // 20 por página, más nuevos primero
getOrderDetail(db: Db, id: number): Promise<null | { order: typeof orders.$inferSelect; items: (typeof orderItems.$inferSelect & { currentStock: number | null })[] }>
```

- [ ] **Step 1: Pruebas que fallan**

`tests/unit/orders-query.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createOrder, confirmOrder } from "@/server/orders";
import { listOrders, getOrderDetail } from "@/server/orders-query";

describe("orders-query", () => {
  it("filtra por estado y busca por código, nombre y teléfono", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db);
    const a = await createOrder(db, { name: "Juan Pérez", phone: "3001112222", items: [{ variantId: v, qty: 1 }] });
    await createOrder(db, { name: "Ana Gómez", phone: "3203334444", items: [{ variantId: v, qty: 1 }] });
    if (a.ok) await confirmOrder(db, a.data.orderId);
    expect((await listOrders(db, { status: "confirmed" })).rows.map((r) => r.customerName)).toEqual(["Juan Pérez"]);
    expect((await listOrders(db, { q: "OFF-0002" })).rows.map((r) => r.customerName)).toEqual(["Ana Gómez"]);
    expect((await listOrders(db, { q: "gómez" })).rows).toHaveLength(1);
    expect((await listOrders(db, { q: "3001112222" })).rows).toHaveLength(1);
    expect((await listOrders(db, {})).total).toBe(2);
  });
  it("detalle incluye stock actual por ítem", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { variants: [{ size: "M", color: "Negro", stock: 4 }] });
    const r = await createOrder(db, { name: "Juan", phone: "3001112222", items: [{ variantId: v, qty: 1 }] });
    if (!r.ok) throw new Error("setup");
    const d = await getOrderDetail(db, r.data.orderId);
    expect(d!.items[0].currentStock).toBe(4);
    expect(await getOrderDetail(db, 9999)).toBeNull();
  });
});
```
Run → Expected: FAIL.

- [ ] **Step 2: Implementar `orders-query.ts`**

`listOrders`: `where` dinámico (`status`, `createdAt >= from`, `createdAt <= to`, `q` con `or(ilike(code), ilike(customerName), ilike(customerPhone))` escapando `%`/`_` del término), `order by created_at desc`, `limit 20 offset (page-1)*20`, más `count(*)` con el mismo filtro. `getOrderDetail`: pedido + `order_items` con `leftJoin variants` para `currentStock` (`null` si la variante fue borrada).

- [ ] **Step 3: Acciones y UI**

`pedidos/actions.ts`:
```ts
"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth";
import { cancelOrder, confirmOrder } from "@/server/orders";

const MSG = {
  invalid_state: "El pedido ya no está en un estado válido para esta acción",
  not_found: "Pedido no encontrado",
  variant_missing: "Un producto del pedido fue eliminado; no se puede confirmar",
} as const;

function humanize(e: any): string {
  if (e.code === "insufficient_stock") {
    return "Stock insuficiente: " + e.lines.map((l: any) => `${l.name} (pide ${l.needed}, hay ${l.available})`).join("; ");
  }
  return (MSG as any)[e.code] ?? "No se pudo completar la acción";
}

async function run(id: number, fn: typeof confirmOrder) {
  await requireAdmin();
  const r = await fn(getDb(), id);
  revalidateTag("catalog"); revalidatePath("/admin/pedidos"); revalidatePath(`/admin/pedidos/${id}`); revalidatePath("/admin");
  return r.ok ? { ok: "Listo" } : { error: humanize(r.error) };
}
export async function confirmOrderAction(id: number) { return run(id, confirmOrder); }
export async function cancelOrderAction(id: number) { return run(id, cancelOrder as any); }
```
`pedidos/page.tsx`: `requireAdmin()`; filtros (estado, fechas, búsqueda) por query params; tabla con código, cliente, teléfono, `Badge` de estado, total (`formatCop`), fecha; paginación; contador de pendientes destacado.
`pedidos/[id]/page.tsx`: `requireAdmin()`, `getOrderDetail` (`notFound()` si `null`); cliente, fechas (creado/confirmado/cancelado), ítems con snapshot, columna "Stock actual" en rojo si `currentStock < qty` o `null` (variante eliminada), total, botón "Abrir chat" (`buildCustomerChatUrl(phone)`, `target="_blank"`), y `OrderActions`.
`OrderActions` (client): botones "Confirmar pedido" (solo `pending`) y "Cancelar" (`pending` o `confirmed`), cada uno en `Dialog` de confirmación (texto del cancelar aclara si devolverá stock); muestra `error`/`ok` devuelto por la acción; deshabilitado en vuelo.

- [ ] **Step 4: Verificar y commit**

Run: `npx vitest run tests/unit` → PASS. Manual: pedido pendiente → Confirmar → stock baja en producto; Cancelar confirmado → stock sube; confirmar con stock insuficiente muestra el mensaje y no cambia nada.
```bash
git add -A && git commit -m "feat(admin): lista y detalle de pedidos con confirmar/cancelar"
```

---

### Task 13: Estadísticas y dashboard

**Files:**
- Create: `src/server/stats.ts`, `src/app/admin/page.tsx`, `src/components/admin/{StatCards,SalesChart,RangeFilter}.tsx`, `tests/unit/stats.test.ts`

**Interfaces:**
- Consumes: schema, `getSettings`.
- Produces:
```ts
type Range = { from: Date; to: Date }
resolveRange(key: "today" | "7d" | "30d" | "month" | "custom", now: Date, custom?: { from: string; to: string }): Range   // límites de día en America/Bogota (UTC-5, sin DST)
getSummary(db: Db, r: Range): Promise<{ sales: number; orders: number; avgTicket: number; pending: number }>   // sales/orders/avg: confirmed por confirmed_at en rango; pending: total actual sin rango
salesByDay(db: Db, r: Range): Promise<{ day: string; total: number; orders: number }[]>     // incluye días sin ventas en 0, day = "YYYY-MM-DD"
topProducts(db: Db, r: Range, limit?: number): Promise<{ name: string; units: number; revenue: number }[]>
lowStock(db: Db, threshold: number): Promise<{ variantId: number; name: string; size: string; colorName: string; stock: number }[]>  // solo productos activos, stock <= threshold, ordenado asc
```

- [ ] **Step 1: Pruebas que fallan**

`tests/unit/stats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedProduct } from "../helpers/db";
import { createOrder, confirmOrder, cancelOrder } from "@/server/orders";
import { getSummary, salesByDay, topProducts, lowStock, resolveRange } from "@/server/stats";
import { orders } from "@/db/schema";

const who = { name: "Juan", phone: "3001234567" };
const wide = { from: new Date("2000-01-01"), to: new Date("2100-01-01") };

async function sale(db: any, variantId: number, qty: number) {
  const r = await createOrder(db, { ...who, items: [{ variantId, qty }] });
  if (!r.ok) throw new Error("setup");
  await confirmOrder(db, r.data.orderId);
  return r.data.orderId;
}

describe("stats", () => {
  it("solo cuenta confirmadas; cancelados y pendientes no suman ventas", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { price: 100000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    await sale(db, v, 2);                                   // 200000
    const c = await sale(db, v, 1); await cancelOrder(db, c); // cancelado
    await createOrder(db, { ...who, items: [{ variantId: v, qty: 1 }] }); // pendiente
    const s = await getSummary(db, wide);
    expect(s).toEqual({ sales: 200000, orders: 1, avgTicket: 200000, pending: 1 });
  });

  it("salesByDay rellena días vacíos y agrupa en hora de Bogotá", async () => {
    const db = await makeTestDb();
    const { variantIds: [v] } = await seedProduct(db, { price: 50000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    const id = await sale(db, v, 1);
    // 2026-03-10 02:00 UTC = 2026-03-09 21:00 Bogotá
    await db.update(orders).set({ confirmedAt: new Date("2026-03-10T02:00:00Z") }).where(eq(orders.id, id));
    const r = resolveRange("custom", new Date("2026-03-12T12:00:00Z"), { from: "2026-03-08", to: "2026-03-10" });
    const rows = await salesByDay(db, r);
    expect(rows).toEqual([
      { day: "2026-03-08", total: 0, orders: 0 },
      { day: "2026-03-09", total: 50000, orders: 1 },
      { day: "2026-03-10", total: 0, orders: 0 },
    ]);
  });

  it("topProducts ordena por unidades e ingreso", async () => {
    const db = await makeTestDb();
    const a = await seedProduct(db, { name: "A", price: 10000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    const b = await seedProduct(db, { name: "B", price: 90000, variants: [{ size: "M", color: "Negro", stock: 20 }] });
    await sale(db, a.variantIds[0], 5); await sale(db, b.variantIds[0], 1);
    const t = await topProducts(db, wide, 5);
    expect(t.map((x) => x.name)).toEqual(["A", "B"]);
    expect(t[0]).toEqual({ name: "A", units: 5, revenue: 50000 });
  });

  it("lowStock excluye inactivos y respeta el umbral", async () => {
    const db = await makeTestDb();
    await seedProduct(db, { name: "Bajo", variants: [{ size: "M", color: "Negro", stock: 2 }, { size: "L", color: "Negro", stock: 9 }] });
    await seedProduct(db, { name: "Oculto", active: false, variants: [{ size: "M", color: "Negro", stock: 0 }] });
    const l = await lowStock(db, 3);
    expect(l.map((x) => `${x.name}/${x.size}`)).toEqual(["Bajo/M"]);
  });

  it("resolveRange today usa día calendario de Bogotá", () => {
    const r = resolveRange("today", new Date("2026-03-10T03:00:00Z")); // 9 mar 22:00 Bogotá
    expect(r.from.toISOString()).toBe("2026-03-09T05:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-03-10T04:59:59.999Z");
  });
});
```
Run → Expected: FAIL.

- [ ] **Step 2: Implementar `stats.ts`**

- `resolveRange`: desplazar `now` a hora Bogotá (`-5h`), calcular medianoche local y volver a UTC (`+5h`). `today`: hoy 00:00–23:59:59.999; `7d`/`30d`: desde 00:00 de hace 6/29 días hasta fin de hoy; `month`: primer día del mes a fin de hoy; `custom`: `from` 00:00 y `to` 23:59:59.999 de esas fechas (si inválidas o `from > to`, caer en `30d`).
- `getSummary`: `select coalesce(sum(total),0), count(*)` de `orders` donde `status='confirmed' and confirmed_at between from and to`; `avgTicket = orders ? Math.round(sales/orders) : 0`; `pending` = `count(*)` donde `status='pending'`.
- `salesByDay`: agrupar con `to_char(confirmed_at at time zone 'America/Bogota', 'YYYY-MM-DD')`; luego generar en JS la lista de días entre `from` y `to` (Bogotá) y rellenar con 0.
- `topProducts`: `order_items` ⨝ `orders` (confirmed en rango), `group by product_name`, `sum(qty)`, `sum(qty*unit_price)`, `order by units desc, revenue desc limit N`.
- `lowStock`: `variants` ⨝ `products` donde `products.active and variants.stock <= threshold`, `order by stock asc, name`; `name` = `products.name`.

- [ ] **Step 3: UI del dashboard**

`admin/page.tsx`: `requireAdmin()`; lee `searchParams.range` (`today|7d|30d|month|custom`, default `30d`) y `from`/`to`; `RangeFilter` (links + formulario de fechas); `StatCards` (ventas `formatCop`, # pedidos, ticket promedio, pendientes con enlace a `/admin/pedidos?status=pending`); `SalesChart` (client, `recharts` `BarChart` con `day` y `total`, eje Y y tooltip formateados con `formatCop`); tabla "Top productos"; lista "Stock bajo" (con etiqueta "Agotado" si `stock === 0`, cada fila enlaza a `/admin/productos/[id]` usando `productId`; añadir `productId` al resultado de `lowStock` y a su prueba).

- [ ] **Step 4: Verificar y commit**

Run: `npx vitest run tests/unit` → PASS. Manual: dashboard con pedidos confirmados refleja los números esperados.
```bash
git add -A && git commit -m "feat(admin): dashboard de ventas, top productos y alertas de stock"
```

---

### Task 14: E2E, endurecimiento y despliegue

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/flow.spec.ts`, `tests/e2e/global-setup.ts`, `README.md`
- Modify: `next.config.ts` (imágenes remotas de Blob), `.gitignore`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Config de imágenes remotas**

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const config: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
};
export default config;
```

- [ ] **Step 2: Playwright**

`playwright.config.ts`: `testDir: "tests/e2e"`, `webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true }`, `use.baseURL`, `globalSetup: "./tests/e2e/global-setup.ts"`. `global-setup.ts` carga `.env.test.local` (DATABASE_URL de una BD **de prueba distinta** a la de desarrollo), corre migraciones y hace `truncate ... restart identity cascade` de tablas de negocio (excepto `admin_users`/`settings`), corre `seed:admin`, y siembra un producto con una variante (M/Negro, stock 5, precio 89900, slug fijo `camiseta-e2e`) insertando directo con Drizzle.

- [ ] **Step 3: Prueba e2e del flujo completo**

`tests/e2e/flow.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("cliente pide, admin confirma y el stock baja", async ({ page, context }) => {
  // Cliente
  await page.goto("/producto/camiseta-e2e");
  await page.getByRole("button", { name: /negro/i }).click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: /agregar al carrito/i }).click();
  await page.goto("/checkout");
  await page.getByLabel(/nombre/i).fill("Cliente E2E");
  await page.getByLabel(/celular|teléfono/i).fill("300 123 4567");
  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: /pedir por whatsapp/i }).click();
  expect((await popup).url()).toContain("wa.me/57");
  await expect(page).toHaveURL(/\/pedido\/OFF-\d{4}/);

  // Admin
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(process.env.ADMIN_EMAIL!);
  await page.getByLabel(/contraseña/i).fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.goto("/admin/pedidos?status=pending");
  await page.getByRole("link", { name: /OFF-\d{4}/ }).first().click();
  await page.getByRole("button", { name: /confirmar pedido/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /confirmar/i }).click();
  await expect(page.getByText(/confirmado/i).first()).toBeVisible();

  // Stock
  await page.goto("/producto/camiseta-e2e");
  await expect(page.getByText(/quedan 4|4 disponibles/i)).toBeVisible();
});

test("admin sin sesión es redirigido al login", async ({ page }) => {
  await page.goto("/admin/pedidos");
  await expect(page).toHaveURL(/\/admin\/login/);
});
```
(Ajustar el texto "quedan 4" al que muestre `VariantPicker`; si no muestra stock, verificar en `/admin/productos/[id]`.)
Run: `npx playwright install chromium && npm run e2e` → Expected: PASS (2).

- [ ] **Step 4: Revisión de endurecimiento**

- `grep -rn "requireAdmin" src/app/admin` → cada `page.tsx` y `actions.ts` protegido lo llama (excepto `login`).
- Confirmar que ninguna Server Action pública (`placeOrder`, `fetchCartLines`) devuelve datos sensibles (teléfonos, ids de pedidos ajenos).
- Confirmar que `SESSION_SECRET` ≥ 32 caracteres en producción (fallar al arrancar si no: en `signSession`, lanzar si `process.env.SESSION_SECRET` es más corto que 32).
- Correr `npm run build && npx vitest run && npm run lint`.

- [ ] **Step 5: README y despliegue**

`README.md` con: requisitos, variables de entorno (`.env.example`), comandos (`db:migrate`, `seed:admin`, `dev`, `test`, `e2e`) y pasos de Vercel:
1. Crear repo remoto y subirlo (`git remote add origin …; git push -u origin main`).
2. En Vercel: **Add New → Project**, importar el repo.
3. **Storage → Marketplace → Neon** (Postgres gratis) y **Storage → Blob**; conectar ambos al proyecto (inyectan `DATABASE_URL` y `BLOB_READ_WRITE_TOKEN`).
4. Agregar variables `SESSION_SECRET` (`openssl rand -base64 48`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
5. Desplegar. Luego, una sola vez, desde local apuntando a la BD de producción: `npm run db:migrate && npm run seed:admin`.
6. Entrar a `/admin/ajustes` y configurar el número de WhatsApp.

- [ ] **Step 6: Commit final**
```bash
git add -A && git commit -m "test(e2e): flujo cliente→admin, endurecimiento y README de despliegue"
```

---

## Self-Review

**Cobertura del spec**
- §2 decisiones (COP, envío fuera, nombre+teléfono, catálogo A, dashboard A, regla de stock A, sin pagos, un admin): Tasks 3, 4, 5, 8–13.
- §3 stack: Task 1 y 14 (Neon vía `pg`, Blob, `jose`, `bcryptjs`, `zod`, `recharts`).
- §4 modelo de datos incl. `stock_movements`, `rate_limits`, `settings.low_stock_threshold`: Task 2.
- §5 flujo de pedido (carrito, `createOrder`, WhatsApp, confirmar/cancelar, rate limit): Tasks 4, 5, 11, 12.
- §6 panel admin (login, rutas, dashboard, productos, pedidos, ajustes): Tasks 6, 7, 9, 12, 13.
- §7 tienda pública (rutas, filtros por query params, caché con tags, SEO, selector color→tallas): Task 10.
- §8 estructura del repo: coincide con *File Structure*.
- §9 errores (zod, `{ok:false}`, transacciones, subidas): Tasks 3–5, 9, 11.
- §10 pruebas (Vitest con PGlite incl. concurrencia, unitarias, Playwright): Tasks 2–6, 8, 12–14.
- §12 despliegue: Task 14.
- Desviación declarada: subida máx. 4 MB (límite de Vercel), registrada en *Global Constraints*.
- `revalidateTag("orders")` en `placeOrder` es inofensivo (no hay caché con ese tag); el dashboard y pedidos admin son dinámicos.

**Consistencia de tipos:** `Result`/`OrderError` (Task 4) usados en Tasks 5 y 12; `Db` (Task 2) en todas las firmas; `MsgLine` (Task 3) usado en `createOrder` (Task 4) y en la página de pedido (Task 11); `CartItem` y `MAX_QTY_PER_LINE` consistentes entre `validators.ts` y `cart.ts`; `lowStock` ganó `productId` en Task 13 (la prueba debe actualizarse en ese mismo paso).

**Placeholders:** ninguno. Las tareas de UI describen componentes por archivo con sus campos, acciones y estados; la lógica que puede fallar (stock, estados, totales, carrito, estadísticas, auth, rate limit) está en código completo con pruebas.
