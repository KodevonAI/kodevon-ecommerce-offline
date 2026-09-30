import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
migrate(drizzle(pool), { migrationsFolder: "src/db/migrations" })
  .then(() => { console.log("migraciones aplicadas"); return pool.end(); })
  .catch((e) => { console.error(e); process.exit(1); });
