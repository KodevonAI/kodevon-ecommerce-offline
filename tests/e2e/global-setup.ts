import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as schema from "../../src/db/schema";

// Solo actúa con E2E_DATABASE_URL (BD de PRUEBA, distinta a la de desarrollo). Sin ella no hace nada.
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) return;
  process.env.ADMIN_EMAIL ??= "admin-e2e@offline.co";
  process.env.ADMIN_PASSWORD ??= "e2e-password-123";
  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: "src/db/migrations" });
    await db.execute(sql`truncate table order_items, stock_movements, orders, product_images, variants, products, categories, rate_limits restart identity cascade`);
    await db.execute(sql`alter sequence order_code_seq restart`);

    const email = process.env.ADMIN_EMAIL.toLowerCase();
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await db.insert(schema.adminUsers).values({ email, passwordHash })
      .onConflictDoUpdate({ target: schema.adminUsers.email, set: { passwordHash } });
    await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();

    const [p] = await db.insert(schema.products).values({
      name: "Camiseta E2E", slug: "camiseta-e2e", price: 89900, active: true,
    }).returning();
    await db.insert(schema.variants).values({ productId: p.id, size: "M", colorName: "Negro", colorHex: "#151515", stock: 5 });
  } finally {
    await pool.end();
  }
}
