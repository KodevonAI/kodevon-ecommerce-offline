export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const EXT: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

/** Valida tipo, extensión y tamaño (máx. 4 MB inclusive). Devuelve el mensaje de error o `null` si es válida. */
export function validateImageFile(f: { name: string; type: string; size: number }): string | null {
  const allowed = EXT[f.type];
  if (!allowed) return `${f.name}: solo jpg, png o webp`;
  const ext = f.name.includes(".") ? (f.name.split(".").pop() ?? "").toLowerCase() : "";
  if (!allowed.includes(ext)) return `${f.name}: la extensión no coincide con el tipo de imagen`;
  if (f.size > MAX_UPLOAD_BYTES) return `${f.name}: máximo 4 MB`;
  return null;
}
