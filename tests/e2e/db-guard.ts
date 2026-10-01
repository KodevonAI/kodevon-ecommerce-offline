// Evita truncar por error una BD real: el global-setup borra datos de negocio.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function assertSafeE2eDatabase(url: string, env: Record<string, string | undefined>): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("E2E_DATABASE_URL es inválida: no se pudo interpretar como URL.");
  }
  if (env.DATABASE_URL && env.DATABASE_URL === url) {
    throw new Error("E2E_DATABASE_URL es igual a DATABASE_URL: el e2e vacía las tablas, usa una BD de prueba distinta.");
  }
  if (env.E2E_ALLOW_TRUNCATE === "1") return;
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (LOCAL_HOSTS.has(parsed.hostname) || /test|e2e/i.test(dbName)) return;
  throw new Error(
    `E2E_DATABASE_URL apunta a "${parsed.hostname}/${dbName}", que no parece una BD de prueba (host local o nombre con "test"/"e2e"). ` +
      "El e2e TRUNCA las tablas. Usa otra BD o define E2E_ALLOW_TRUNCATE=1 si estás seguro.",
  );
}
