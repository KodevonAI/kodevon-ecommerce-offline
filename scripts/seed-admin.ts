import { getDb } from "../src/db/client";
import { adminUsers, settings } from "../src/db/schema";
import { hashPassword } from "../src/server/auth";

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ADMIN_EMAIL y ADMIN_PASSWORD requeridas");
  const db = getDb();
  const passwordHash = await hashPassword(password);
  await db.insert(adminUsers).values({ email, passwordHash })
    .onConflictDoUpdate({ target: adminUsers.email, set: { passwordHash } });
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  console.log("admin listo:", email);
  process.exit(0);
}
main();
