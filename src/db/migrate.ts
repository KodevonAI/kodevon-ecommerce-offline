import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { describeTarget, loadCliEnv, requireDatabaseUrl } from "./cli-env";

loadCliEnv();
const url = requireDatabaseUrl();
console.log(`Aplicando migraciones en ${describeTarget(url)}`);

const pool = new Pool({ connectionString: url });
migrate(drizzle(pool), { migrationsFolder: "src/db/migrations" })
  .then(() => { console.log("migraciones aplicadas"); return pool.end(); })
  .catch((e) => { console.error(e); process.exit(1); });
