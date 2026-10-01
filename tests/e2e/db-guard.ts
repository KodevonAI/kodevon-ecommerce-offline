// Evita truncar por error una BD real: el global-setup borra datos de negocio.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

// Identidad normalizada de una conexión: host, puerto, nombre de BD y usuario (sin contraseña ni query).
function identity(url: string): string | null {
  try {
    const u = new URL(url);
    const port = u.port || "5432";
    const db = decodeURIComponent(u.pathname.replace(/^\/+|\/+$/g, "")).toLowerCase();
    return [u.hostname.toLowerCase(), port, db, decodeURIComponent(u.username).toLowerCase()].join("|");
  } catch {
    return null;
  }
}

export function assertSafeE2eDatabase(url: string, env: Record<string, string | undefined>): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("E2E_DATABASE_URL es inválida: no se pudo interpretar como URL.");
  }
  if (env.DATABASE_URL && identity(env.DATABASE_URL) === identity(url)) {
    throw new Error("E2E_DATABASE_URL es igual a DATABASE_URL: el e2e vacía las tablas, usa una BD de prueba distinta.");
  }
  if (env.E2E_ALLOW_TRUNCATE === "1") return;
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const tokens = dbName.toLowerCase().split(/[^a-z0-9]+/);
  if (LOCAL_HOSTS.has(parsed.hostname) || tokens.includes("test") || tokens.includes("e2e")) return;
  throw new Error(
    `E2E_DATABASE_URL apunta a "${parsed.hostname}/${dbName}", que no parece una BD de prueba (host local o nombre con la palabra "test" o "e2e"). ` +
      "El e2e TRUNCA las tablas. Usa otra BD o define E2E_ALLOW_TRUNCATE=1 si estás seguro.",
  );
}
