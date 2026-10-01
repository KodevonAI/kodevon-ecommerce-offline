"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { adminUsers, settings } from "@/db/schema";
import { hashPassword, requireAdmin, verifyPassword } from "@/server/auth";
import { hit } from "@/server/ratelimit";
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
  if (!u) return { error: "Sesión inválida, vuelve a iniciar sesión" };
  if (!(await hit(db, "pwd:" + adminId, 5, 900))) return { error: "Demasiados intentos, espera unos minutos" };
  if (!(await verifyPassword(current, u.passwordHash))) return { error: "Contraseña actual incorrecta" };
  await db.update(adminUsers).set({ passwordHash: await hashPassword(next) }).where(eq(adminUsers.id, adminId));
  return { ok: "Contraseña actualizada" };
}
