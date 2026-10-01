import { describe, it, expect, beforeAll } from "vitest";
import { makeTestDb } from "../helpers/db";
import { hashPassword, verifyPassword, signSession, readSession, loginAdmin } from "@/server/auth";
import { adminUsers } from "@/db/schema";

beforeAll(() => { process.env.SESSION_SECRET = "x".repeat(40); });

describe("auth", () => {
  it("hash y verificación", async () => {
    const h = await hashPassword("secreto123");
    expect(await verifyPassword("secreto123", h)).toBe(true);
    expect(await verifyPassword("otra", h)).toBe(false);
  });
  it("sesión firmada ida y vuelta; token inválido → null", async () => {
    const t = await signSession(7);
    expect(await readSession(t)).toEqual({ adminId: 7 });
    expect(await readSession(t + "x")).toBeNull();
    expect(await readSession(undefined)).toBeNull();
  });
  it("loginAdmin con email desconocido → invalid", async () => {
    const db = await makeTestDb();
    expect(await loginAdmin(db, "nadie@b.co", "pass12345", "9.9.9.9")).toEqual({ ok: false, error: "invalid" });
  });
  it("loginAdmin ok, inválido y bloqueo por intentos", async () => {
    const db = await makeTestDb();
    await db.insert(adminUsers).values({ email: "a@b.co", passwordHash: await hashPassword("pass12345") });
    expect(await loginAdmin(db, "a@b.co", "pass12345", "1.1.1.1")).toEqual({ ok: true, adminId: expect.any(Number) });
    expect(await loginAdmin(db, "a@b.co", "mala", "2.2.2.2")).toEqual({ ok: false, error: "invalid" });
    for (let i = 0; i < 6; i++) await loginAdmin(db, "a@b.co", "mala", "3.3.3.3");
    expect(await loginAdmin(db, "a@b.co", "pass12345", "3.3.3.3")).toEqual({ ok: false, error: "rate_limited" });
  });
});
