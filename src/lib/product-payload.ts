import { productFullSchema, type ProductFullInput } from "@/lib/validators";

/** Interpreta el campo oculto `payload` del editor de productos y lo valida con `productFullSchema`. */
export function parseProductPayload(text: string): { ok: true; data: ProductFullInput } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Datos inválidos" };
  }
  const parsed = productFullSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  return { ok: true, data: parsed.data };
}

const SIZE_ERRORS = new Set(["Talla duplicada", "Talla vacía"]);

function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) => (typeof x === "object" && x !== null ? (x as { code?: unknown }).code : undefined);
  return code(e) === "23505" || code(typeof e === "object" && e !== null ? (e as { cause?: unknown }).cause : undefined) === "23505";
}

/** Traduce un error de createProductFull/updateProductFull a un mensaje para el admin (sin filtrar detalles internos). */
export function mapSaveError(e: unknown): string {
  if (e instanceof Error && SIZE_ERRORS.has(e.message)) return e.message;
  if (isUniqueViolation(e)) return "No se pudo guardar el producto. Inténtalo de nuevo.";
  return "No se pudo guardar el producto";
}
