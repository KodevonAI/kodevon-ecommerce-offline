/** Escapa \, % y _ para usar el término como texto literal dentro de LIKE/ILIKE. */
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);
