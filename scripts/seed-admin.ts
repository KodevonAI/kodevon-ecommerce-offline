import { ne } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { describeTarget, loadCliEnv, requireDatabaseUrl } from "../src/db/cli-env";
import { adminUsers, settings } from "../src/db/schema";
import { hashPassword } from "../src/server/auth";

async function main() {
  loadCliEnv();
  const url = requireDatabaseUrl();
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ADMIN_EMAIL y ADMIN_PASSWORD requeridas");
  console.log(`Creando/actualizando admin en ${describeTarget(url)}`);
  const db = getDb();
  const passwordHash = await hashPassword(password);
  await db.insert(adminUsers).values({ email, passwordHash })
    .onConflictDoUpdate({ target: adminUsers.email, set: { passwordHash } });
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const others = await db.select({ email: adminUsers.email }).from(adminUsers).where(ne(adminUsers.email, email));
  if (others.length > 0) {
    console.warn(`AVISO: existen otros admins con distinto email (no se borran): ${others.map((o) => o.email).join(", ")}`);
  }
  console.log("admin listo:", email);
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
