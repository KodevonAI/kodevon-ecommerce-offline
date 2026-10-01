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
const secret = () => {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(s);
};

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function signSession(adminId: number) {
  return new SignJWT({ adminId }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(`${MAX_AGE}s`).sign(secret());
}
export async function readSession(token: string | undefined): Promise<{ adminId: number } | null> {
  if (!token) return null;
  const key = secret(); // fuera del try: un secreto inválido debe fallar con ruido
  try {
    const { payload } = await jwtVerify(token, key);
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
