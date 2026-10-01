# OFFLINE — tienda de ropa

Ecommerce de ropa (precios en COP) con pedido por WhatsApp: el cliente arma el carrito, deja nombre y celular, y se abre WhatsApp con el pedido listo. No hay pagos ni envío en línea. Un solo admin gestiona productos, categorías, pedidos y ajustes.

## Stack

Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind 4 + shadcn/ui · Postgres (Neon) con Drizzle ORM y `pg` · Vercel Blob (fotos) · `jose` + `bcryptjs` (sesión admin) · `zod` · `recharts` · Vitest + PGlite (unitarias) · Playwright (e2e).

## Variables de entorno

Copia `.env.example` a `.env.local`.

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión Postgres (Neon). |
| `SESSION_SECRET` | Secreto de la sesión admin, **mínimo 32 caracteres** (`openssl rand -base64 48`). Sin él (o si es corto) el login falla y el middleware trata todo como no autenticado. |
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob para subir fotos. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Credenciales que crea `seed:admin`. |
| `E2E_DATABASE_URL` | (opcional) BD **de prueba, distinta a la de desarrollo**, para el e2e con base de datos. Se trunca en cada corrida. |
| `DEMO_MODE` | (opcional) `1` sirve la tienda con datos de ejemplo en memoria, sin base de datos. **Solo desarrollo**: se ignora si `NODE_ENV=production`. Nunca la definas en producción. |

## Comandos

```bash
npm run dev            # servidor de desarrollo
npm run db:generate    # genera migraciones desde src/db/schema.ts
npm run db:migrate     # aplica migraciones (usa .env.local)
npm run seed:admin     # crea/actualiza el admin y la fila de ajustes
npm test               # unitarias (Vitest + PGlite, sin BD externa)
npm run e2e            # Playwright
npm run lint
DEMO_MODE=1 npm run dev  # tienda de demo sin base de datos
```

### E2E

`npm run e2e` tiene dos proyectos (instala el navegador una vez con `npx playwright install chromium`):

- `demo`: tienda con `DEMO_MODE=1` en el puerto 3200 (home, filtros, producto → carrito → checkout → `/pedido/OFF-DEMO`, redirección del admin y 404). No necesita base de datos.
- `db`: flujo completo cliente → admin confirma → stock baja (`tests/e2e/flow.spec.ts`), en el puerto 3201 con Postgres real. Solo corre si defines `E2E_DATABASE_URL`; sin ella se omite. `global-setup.ts` migra, vacía las tablas de negocio, crea el admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, por defecto `admin-e2e@offline.co`) y siembra el producto `camiseta-e2e`.

```bash
E2E_DATABASE_URL=postgres://… npm run e2e
```

> Nota: el proyecto `db` no se ha ejecutado todavía (se escribió sin acceso a Postgres). Córrelo una vez contra una BD de prueba antes de confiar en él.

## Despliegue en Vercel

1. Crea un repo remoto y súbelo (`git remote add origin …; git push -u origin main`).
2. En Vercel: **Add New → Project** e importa el repo.
3. **Storage → Marketplace → Neon** (Postgres gratis) y **Storage → Blob**; conecta ambos al proyecto (inyectan `DATABASE_URL` y `BLOB_READ_WRITE_TOKEN`).
4. Agrega las variables `SESSION_SECRET` (`openssl rand -base64 48`), `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
5. Despliega. Luego, una sola vez, desde local apuntando a la BD de producción: `npm run db:migrate && npm run seed:admin`.
6. Entra a `/admin/ajustes` y configura el número de WhatsApp.

## Notas conocidas

- Las fotos suben con un máximo de 4 MB por archivo (límite de cuerpo de las funciones de Vercel).
- Los pedidos pendientes no expiran ni reservan stock: el stock solo baja al confirmar el pedido en el admin.
- La página pública de pedido (`/pedido/OFF-XXXX`) no muestra nombre ni teléfono del cliente.
- Las sesiones de admin no se pueden revocar (JWT de 7 días); para invalidarlas todas, cambia `SESSION_SECRET`.
- La concurrencia del bloqueo de stock solo se probó en PGlite (una sola conexión). Antes del lanzamiento, ejecuta una prueba con dos conexiones simultáneas contra un Postgres/Neon real.
