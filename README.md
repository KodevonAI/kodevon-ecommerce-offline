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
- Una talla quitada de un producto que ya tiene pedidos no se borra: queda con stock 0 (se conserva el historial) y reaparece en el editor con stock 0.

## Diseño

Estilo sobrio tipo Apple: blanco y gris claro, un solo acento azul, radios grandes y sombras difusas. Los tokens de color y las clases `t-*` / `press` viven en `src/app/globals.css`.

**Modo claro/oscuro:** el icono sol/luna del header alterna el modo al instante y guarda la elección en la cookie `offline-theme` (`light` | `dark`, un año). Sin cookie sigue al sistema (`prefers-color-scheme`). Los tokens oscuros están en `globals.css` (bloque `:root[data-theme="dark"]` y su espejo para el sistema).

**Textos de envío, cambios y pago** (producto, home): `src/lib/store-info.ts`. Hoy dicen que todo se acuerda por WhatsApp; cuando haya política formal (plazos, costos, envío gratis desde cierto monto) se edita ahí.

**Más vendidos:** el home muestra "Lo más vendido" solo con ventas reales (pedidos confirmados de los últimos 90 días) y al menos 3 productos. En modo demo no hay ventas, así que la sección no aparece.

**Favoritos:** se guardan en el navegador (`localStorage`, sin cuenta) y se listan en `/favoritos`.

Las páginas `/privacidad` y `/terminos` son un borrador basado en cómo funciona la tienda: que las revise un abogado antes de publicar. El sitemap usa `VERCEL_PROJECT_PRODUCTION_URL` para las URLs absolutas.

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

0. Verifica que el `DATABASE_URL` de los despliegues Preview de Vercel no apunte a la BD de producción.
1. **Chequeos previos en Neon (solo lectura).** Cada consulta debe devolver **0 filas**, salvo que se indique otra cosa:

   ```sql
   -- migraciones aplicadas (se revisa ANTES de migrar): deben ser 2 filas, la última con created_at = 1790828356728
   select id, created_at from drizzle.__drizzle_migrations order by created_at;
   -- ningún producto con más de un color en sus variantes
   select p.name from products p
   where (select count(distinct v.color_name) from variants v where v.product_id = p.id) > 1;
   select id, url from product_images where url !~* '^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/.+';
   select product_id, count(*) from product_images group by 1 having count(*) > 12;
   select distinct color_name, color_hex from variants where length(btrim(color_name)) > 40 or color_hex !~ '^#[0-9a-fA-F]{6}$';
   select product_id, size from variants where length(btrim(size)) > 10;
   select product_id, count(*) from variants group by 1 having count(*) > 30;
   select product_id, upper(regexp_replace(btrim(size), '\s+', ' ', 'g')) s, count(*) from variants group by 1, 2 having count(*) > 1;
   select id, name from products where length(btrim(name)) < 2 or length(name) > 120 or length(description) > 4000 or (sale_price is not null and sale_price >= price);
   -- informativo: productos sin variantes (quedarán sin color)
   select count(*) from products p where not exists (select 1 from variants v where v.product_id = p.id);
   ```

   Los datos que estas consultas encuentren no pasarían el validador nuevo del admin (el producto no se podría editar): corrígelos antes de migrar.

2. **No crees ni edites productos entre migrar y desplegar (congela el admin).** Migra: `DATABASE_URL="<url>" npm run db:migrate`. Ojo: entre migrar y desplegar, el admin viejo que agregue una talla repetida en un segundo color la ignora en silencio; **despliega justo después**.
3. Sube a `main` para que Vercel despliegue.
4. **Después del despliegue**: ejecuta este backfill (idempotente) y vuelve a correr la consulta de varios colores del paso 1:

   ```sql
   update products p set color_name = v.color_name, color_hex = v.color_hex
   from (select distinct on (product_id) product_id, color_name, color_hex
         from variants where color_name <> '' order by product_id, id) v
   where v.product_id = p.id and p.color_name = '';
   ```

5. Prueba rápida: home, filtro de color en `/tienda`, ficha de producto cambiando de color con una talla seleccionada, carrito, checkout hasta el enlace de WhatsApp, dashboard del admin con "Top productos", y guardar un producto antiguo sin cambios.
6. Las columnas antiguas `variants.color_name` y `variants.color_hex` quedan en desuso; su limpieza va en una migración posterior.

**Rollback:** el rollback instantáneo de Vercel al despliegue anterior es seguro para el esquema, pero los productos creados con el código nuevo tienen vacío el color de las variantes antiguas, así que la UI vieja mostrará un color vacío para ellos.

## Notas conocidas

- Las fotos suben con un máximo de 4 MB por archivo (límite de cuerpo de las funciones de Vercel).
- Los pedidos pendientes no expiran ni reservan stock: el stock solo baja al confirmar el pedido en el admin.
- La página pública de pedido (`/pedido/OFF-XXXX`) no muestra nombre ni teléfono del cliente.
- Las sesiones de admin no se pueden revocar (JWT de 7 días); para invalidarlas todas, cambia `SESSION_SECRET`.
- La concurrencia del bloqueo de stock solo se probó en PGlite (una sola conexión). Antes del lanzamiento, ejecuta una prueba con dos conexiones simultáneas contra un Postgres/Neon real.
