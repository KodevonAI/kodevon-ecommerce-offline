export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const EXT: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

/** Valida tipo, extensión y tamaño (máx. 4 MB inclusive). Devuelve el mensaje de error o `null` si es válida. */
export function validateImageFile(f: { name: string; type: string; size: number }): string | null {
  if (f.size === 0) return `${f.name}: archivo vacío`;
  const allowed = EXT[f.type];
  if (!allowed) return `${f.name}: solo jpg, png o webp`;
  const ext = f.name.includes(".") ? (f.name.split(".").pop() ?? "").toLowerCase() : "";
  if (!allowed.includes(ext)) return `${f.name}: la extensión no coincide con el tipo de imagen`;
  if (f.size > MAX_UPLOAD_BYTES) return `${f.name}: máximo 4 MB`;
  return null;
}

const MAX_BLOB_NAME = 80;

/** Nombre seguro para el pathname del Blob: caracteres saneados y máx. 80, conservando la extensión. */
export function blobFileName(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (safe.length <= MAX_BLOB_NAME) return safe;
  const dot = safe.lastIndexOf(".");
  const ext = dot > 0 ? safe.slice(dot) : "";
  return safe.slice(0, MAX_BLOB_NAME - ext.length) + ext;
}
