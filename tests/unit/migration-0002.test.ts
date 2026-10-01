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
