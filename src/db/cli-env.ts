import { config } from "dotenv";

/** Carga .env.local si existe, sin pisar variables ya exportadas (DATABASE_URL del shell gana). */
export function loadCliEnv(): void {
  config({ path: ".env.local", override: false, quiet: true });
}

/** Devuelve DATABASE_URL o termina con un error claro (pg caería en silencio a localhost). */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL no está definida. Expórtala o ponla en .env.local, p. ej.: DATABASE_URL=\"<url>\" npm run db:migrate");
    process.exit(1);
  }
  return url;
}

/** host:puerto/base de datos, nunca usuario ni contraseña. */
export function describeTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(URL no válida)";
  }
}
