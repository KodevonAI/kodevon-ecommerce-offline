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
