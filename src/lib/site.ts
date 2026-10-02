/** URL pública del sitio: dominio de producción de Vercel si existe; si no, localhost. */
export function siteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : `http://localhost:${process.env.PORT ?? 3000}`;
}
