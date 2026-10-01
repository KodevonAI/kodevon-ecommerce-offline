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
| `E2E_ALLOW_TRUNCATE` | (opcional) `1` desactiva la guarda de `global-setup.ts` (ver E2E). Úsalo solo si estás seguro de que la BD es descartable. |
| `DEMO_MODE` | (opcional) `1` sirve la tienda con datos de ejemplo en memoria, sin base de datos. **Solo desarrollo**: `isDemoMode()` exige `DEMO_MODE=1` y `NODE_ENV!=="production"`, así que se ignora en producción (`next build`/`next start`). Aun así, nunca la definas en producción. |

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
- `db`: flujo completo cliente → admin confirma → stock baja (`tests/e2e/flow.spec.ts`), en el puerto 3201 con Postgres real. Solo corre si defines `E2E_DATABASE_URL`; sin ella se omite. **El setup TRUNCA las tablas de negocio**, por eso `tests/e2e/db-guard.ts` se niega a continuar (antes de conectar) si la URL apunta a la misma BD que `DATABASE_URL` (se compara host, puerto, nombre de BD y usuario normalizados, leyendo también `.env.local`), o si el host no es local y el nombre de la BD no tiene la palabra `test` o `e2e` (separada por `_`, `-`, etc.); `E2E_ALLOW_TRUNCATE=1` salta solo la segunda comprobación. Es una red de seguridad contra errores, no una garantía: no detecta una BD real con otro host/alias. `global-setup.ts` migra, vacía las tablas de negocio, crea el admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, por defecto `admin-e2e@offline.co`) y siembra el producto `camiseta-e2e`.

```bash
E2E_DATABASE_URL=postgres://… npm run e2e
```

El flujo `db` cubre: pedido (el cliente elige la talla) → confirmación → stock en el editor del producto; alta de un producto con color desde `/admin/productos/nuevo` y su eliminación; y el botón "Archivar" en un producto con pedidos.

> Nota: el proyecto `db` no se ha ejecutado todavía (se escribió sin acceso a Postgres). Córrelo una vez contra una BD de prueba antes de confiar en él.

## Cargar productos

Un producto es **un color**: nombre, descripción, precio, color, fotos y tallas. En `/admin/productos/nuevo`:

1. Escribe el nombre **sin el color** y elige el color con el selector (o el gotero, en Chrome/Edge de escritorio). El nombre del color se propone solo (el más cercano de la paleta) y puedes corregirlo.
2. Sube las fotos: se suben antes de guardar y se guardan junto con el producto.
3. Elige las tallas y su stock inicial.
4. Pulsa **Guardar**.

Para el mismo modelo en otro color usa **Agregar otro color** (en la página del producto): crea un producto nuevo con los datos copiados, y en la tienda los colores del modelo aparecen como círculos que llevan de uno a otro. El stock de tallas ya guardadas se ajusta con **+/−** (queda registrado como movimiento manual); las tallas nuevas o quitadas se aplican al guardar.

### Eliminar vs archivar

- **Eliminar**: solo si el producto nunca tuvo pedidos (los pedidos cancelados también cuentan). Borra el producto, sus fotos y su stock.
- **Archivar / Reactivar**: si tiene pedidos. El producto deja de verse en la tienda pero se conserva el historial; se puede reactivar.

## Despliegue en Vercel

1. Crea un repo remoto y súbelo (`git remote add origin …; git push -u origin main`).
2. En Vercel: **Add New → Project** e importa el repo (aún sin desplegar).
3. **Storage → Marketplace → Neon** (Postgres gratis) y **Storage → Blob**; conecta ambos al proyecto (inyectan `DATABASE_URL` y `BLOB_READ_WRITE_TOKEN`).
4. Agrega la variable `SESSION_SECRET` (`openssl rand -base64 48`).
5. **Antes del primer despliegue** (o al menos antes de enviar tráfico), aplica las migraciones y crea el admin contra la BD de producción, pasando la URL en el comando para no tocar `.env.local`:

   ```bash
   DATABASE_URL="<url de producción>" npm run db:migrate
   DATABASE_URL="<url de producción>" ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD='<contraseña>' npm run seed:admin
   ```

   Alternativa: `vercel env pull .env.production.local` y exporta `DATABASE_URL` desde ahí. Ambos comandos imprimen el host y la base de datos que van a tocar; verifícalo antes de continuar.
   **Ojo:** si los ejecutas sin `DATABASE_URL` en el comando, usan la de `.env.local` (tu BD de desarrollo) y migran esa.
6. Despliega.
7. Entra a `/admin/ajustes` y configura el número de WhatsApp. Hasta entonces la tienda no acepta pedidos y el dashboard muestra un aviso.

### Migración 0002 (color como producto)

Mueve el color de las variantes al producto. Es aditiva: el código desplegado antes sigue funcionando con la BD migrada (`model_id` tiene valor por defecto en la BD, así que los inserts viejos funcionan).

1. **Antes de migrar**, en la consola SQL de Neon (solo lectura); debe devolver **0 filas** (ningún producto con más de un color en sus variantes):

   ```sql
   select p.name from products p
   where (select count(distinct v.color_name) from variants v where v.product_id = p.id) > 1;
   ```

2. Migra: `DATABASE_URL="<url>" npm run db:migrate`. Ojo: entre migrar y desplegar, el admin viejo que agregue una talla repetida en un segundo color la ignora en silencio; **despliega justo después**.
3. Sube a `main` para que Vercel despliegue.
4. Las columnas antiguas `variants.color_name` y `variants.color_hex` quedan en desuso; su limpieza va en una migración posterior.

## Notas conocidas

- Las fotos suben con un máximo de 4 MB por archivo (límite de cuerpo de las funciones de Vercel).
- Los pedidos pendientes no expiran ni reservan stock: el stock solo baja al confirmar el pedido en el admin.
- La página pública de pedido (`/pedido/OFF-XXXX`) no muestra nombre ni teléfono del cliente.
- Las sesiones de admin no se pueden revocar (JWT de 7 días); para invalidarlas todas, cambia `SESSION_SECRET`.
- La concurrencia del bloqueo de stock solo se probó en PGlite (una sola conexión). Antes del lanzamiento, ejecuta una prueba con dos conexiones simultáneas contra un Postgres/Neon real.
