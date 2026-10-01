import { describe, it, expect } from "vitest";
import { assertSafeE2eDatabase } from "../e2e/db-guard";

describe("assertSafeE2eDatabase", () => {
  it("acepta localhost", () => {
    expect(() => assertSafeE2eDatabase("postgres://u:p@localhost:5432/offline", {})).not.toThrow();
    expect(() => assertSafeE2eDatabase("postgres://u:p@127.0.0.1/offline", {})).not.toThrow();
    expect(() => assertSafeE2eDatabase("postgres://u:p@[::1]:5432/offline", {})).not.toThrow();
  });
  it("acepta host remoto con nombre de BD de prueba", () => {
    expect(() => assertSafeE2eDatabase("postgres://u:p@ep-x.neon.tech/myapp_e2e?sslmode=require", {})).not.toThrow();
  });
  it("rechaza host remoto con BD neondb", () => {
    expect(() => assertSafeE2eDatabase("postgres://u:p@ep-x.neon.tech/neondb", {})).toThrow(/E2E_ALLOW_TRUNCATE/);
  });
  it("rechaza si es igual a DATABASE_URL, incluso en localhost", () => {
    const u = "postgres://u:p@localhost:5432/offline_e2e";
    expect(() => assertSafeE2eDatabase(u, { DATABASE_URL: u })).toThrow(/DATABASE_URL/);
  });
  it("E2E_ALLOW_TRUNCATE=1 permite el override", () => {
    expect(() => assertSafeE2eDatabase("postgres://u:p@ep-x.neon.tech/neondb", { E2E_ALLOW_TRUNCATE: "1" })).not.toThrow();
  });
  it("rechaza una URL mal formada", () => {
    expect(() => assertSafeE2eDatabase("no-es-una-url", {})).toThrow(/inválida/);
  });
});
