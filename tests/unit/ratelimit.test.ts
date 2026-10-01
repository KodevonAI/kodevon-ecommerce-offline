import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { sql } from "drizzle-orm";
import { hit } from "@/server/ratelimit";

describe("hit", () => {
  it("permite hasta el límite y luego bloquea", async () => {
    const db = await makeTestDb();
    const res = [];
    for (let i = 0; i < 5; i++) res.push(await hit(db, "ip:1", 3, 60));
    expect(res).toEqual([true, true, true, false, false]);
  });
  it("al vencer la ventana el contador se reinicia", async () => {
    const db = await makeTestDb();
    expect(await hit(db, "w", 1, 60)).toBe(true);
    expect(await hit(db, "w", 1, 60)).toBe(false);
    await db.execute(sql`update rate_limits set window_start = now() - interval '2 minutes' where key = 'w'`);
    expect(await hit(db, "w", 1, 60)).toBe(true);
    const r = await db.execute(sql`select count from rate_limits where key = 'w'`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(Number((r as any).rows[0].count)).toBe(1);
  });
  it("claves independientes", async () => {
    const db = await makeTestDb();
    await hit(db, "a", 1, 60);
    expect(await hit(db, "a", 1, 60)).toBe(false);
    expect(await hit(db, "b", 1, 60)).toBe(true);
  });
});
