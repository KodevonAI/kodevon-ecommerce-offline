// Helper sin dependencias de Node: se usa en el servidor (auth.ts) y en el edge (middleware.ts).
export const MIN_SECRET_LENGTH = 32;

/** Devuelve el secreto de sesión como bytes, o null si falta o es demasiado corto. */
export function sessionSecretKey(raw: string | undefined = process.env.SESSION_SECRET): Uint8Array | null {
  const s = raw ?? "";
  return s.length >= MIN_SECRET_LENGTH ? new TextEncoder().encode(s) : null;
}
