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
  it("rechaza la misma BD aunque difieran query, barra final, esquema o contraseña", () => {
    const dev = { DATABASE_URL: "postgres://u:p@Localhost:5432/offline_e2e" };
    for (const v of [
      "postgres://u:p@localhost:5432/offline_e2e?sslmode=require",
      "postgres://u:p@localhost:5432/offline_e2e/",
      "postgresql://u:p@localhost:5432/offline_e2e",
      "postgres://u:otra@localhost:5432/offline_e2e",
      "postgres://u:p@LOCALHOST/offline_e2e",
    ]) {
      expect(() => assertSafeE2eDatabase(v, dev), v).toThrow(/DATABASE_URL/);
    }
  });
  it("la igualdad con DATABASE_URL no se salta con E2E_ALLOW_TRUNCATE", () => {
    const u = "postgres://u:p@localhost:5432/offline";
    expect(() => assertSafeE2eDatabase(u + "?x=1", { DATABASE_URL: u, E2E_ALLOW_TRUNCATE: "1" })).toThrow(/DATABASE_URL/);
  });
  it("otra BD en el mismo servidor no cuenta como igual", () => {
    expect(() => assertSafeE2eDatabase("postgres://u:p@localhost:5432/offline_e2e", { DATABASE_URL: "postgres://u:p@localhost:5432/offline" })).not.toThrow();
  });
  it("el nombre debe contener test/e2e como palabra", () => {
    expect(() => assertSafeE2eDatabase("postgres://u:p@ep-x.neon.tech/offline-test", {})).not.toThrow();
    expect(() => assertSafeE2eDatabase("postgres://u:p@ep-x.neon.tech/latest", {})).toThrow(/E2E_ALLOW_TRUNCATE/);
    expect(() => assertSafeE2eDatabase("postgres://u:p@ep-x.neon.tech/contest", {})).toThrow(/E2E_ALLOW_TRUNCATE/);
  });
  it("E2E_ALLOW_TRUNCATE=1 permite el override", () => {
    expect(() => assertSafeE2eDatabase("postgres://u:p@ep-x.neon.tech/neondb", { E2E_ALLOW_TRUNCATE: "1" })).not.toThrow();
  });
  it("rechaza una URL mal formada", () => {
    expect(() => assertSafeE2eDatabase("no-es-una-url", {})).toThrow(/inválida/);
  });
});
