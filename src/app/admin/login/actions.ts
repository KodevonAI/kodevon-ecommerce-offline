"use server";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { clientIp, createSession, destroySession, loginAdmin } from "@/server/auth";

export async function loginAction(_: { error?: string } | undefined, fd: FormData) {
  const r = await loginAdmin(getDb(), String(fd.get("email") ?? ""), String(fd.get("password") ?? ""), await clientIp());
  if (!r.ok) return { error: r.error === "rate_limited" ? "Demasiados intentos. Espera 15 minutos." : "Credenciales inválidas" };
  await createSession(r.adminId);
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}
