export type SizeRow = { size: string; stock: number; variantId?: number };

/**
 * Fila al volver a agregar una talla: si el servidor aún la tiene guardada (se quitó sin pulsar Guardar) se
 * recupera con su stock real; si ya no existe allí (se quitó y se guardó) es una fila nueva con stock 0.
 */
export function rowForAddedSize(size: string, saved: SizeRow[]): SizeRow {
  const s = saved.find((r) => r.size === size && r.variantId !== undefined);
  return s ? { ...s } : { size, stock: 0 };
}
