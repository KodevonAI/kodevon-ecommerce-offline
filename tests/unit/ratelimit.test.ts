import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { hit } from "@/server/ratelimit";

describe("hit", () => {
  it("permite hasta el límite y luego bloquea", async () => {
    const db = await makeTestDb();
    const res = [];
    for (let i = 0; i < 5; i++) res.push(await hit(db, "ip:1", 3, 60));
    expect(res).toEqual([true, true, true, false, false]);
  });
  it("claves independientes", async () => {
    const db = await makeTestDb();
    await hit(db, "a", 1, 60);
    expect(await hit(db, "a", 1, 60)).toBe(false);
    expect(await hit(db, "b", 1, 60)).toBe(true);
  });
});
