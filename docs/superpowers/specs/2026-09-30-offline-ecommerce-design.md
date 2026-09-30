# OFFLINE — Ecommerce de ropa: diseño

Fecha: 2026-09-30

## 1. Objetivo y contexto

Tienda en línea para la marca de ropa **OFFLINE** (Colombia, moneda COP). El cliente arma un carrito y hace el pedido por **WhatsApp**. El administrador gestiona productos, confirma pedidos (lo que descuenta inventario) y ve ventas y métricas en un panel.

**Criterios de éxito**
- Catálogo con variantes talla-color, cada una con stock propio.
- Cliente puede navegar, filtrar, agregar al carrito y enviar el pedido por WhatsApp sin crear cuenta.
- Al confirmar un pedido en el admin, el inventario se descuenta de forma atómica y sin sobreventa.
- Admin ve ventas, pedidos pendientes, top productos y alertas de stock.
- Despliegue en Vercel, costo cero, con el mínimo de servicios externos.

## 2. Decisiones acordadas

| Tema | Decisión |
|---|---|
| País / moneda | Colombia, COP enteros sin decimales, prefijo WhatsApp +57 |
| Envíos | Fuera del sistema. Se acuerdan por WhatsApp; el total solo muestra productos |
| Datos del cliente | Solo nombre y teléfono (móvil colombiano: 10 dígitos, inicia en 3) |
| Catálogo v1 | Categorías, varias fotos, precio de oferta opcional, activo/oculto, búsqueda y filtros (categoría, talla, color, precio, oferta) |
| Dashboard | Ventas del día/semana/mes con filtro de rango, ticket promedio, gráfico por día, top productos, alertas de stock bajo, pedidos pendientes |
| Regla de stock | El stock baja solo al confirmar. Los pendientes no reservan. Si al confirmar no alcanza, se bloquea y se avisa |
| Pagos | Sin pagos en línea. Se coordinan por WhatsApp |
| Admin | Un solo admin, email + contraseña |

## 3. Stack

Todo en un único repo Next.js desplegado en Vercel.

- **Next.js (App Router)**, Server Actions, Tailwind + shadcn/ui.
- **Postgres (Neon)**, provisionado desde Vercel Marketplace (gestionado desde el dashboard de Vercel). ORM: **Drizzle**, migraciones con `drizzle-kit`.
- **Vercel Blob** para imágenes de producto.
- **Auth propio**: cookie httpOnly firmada con `jose`, hash `bcrypt`. Sin Auth.js ni servicios externos.
- **WhatsApp**: enlace `wa.me` con mensaje prellenado. Sin API ni cuenta Business.
- Validación con `zod`. Gráficos con `recharts`.
- Sin Supabase, Auth0, Cloudinary, Stripe, servicio de email ni otros.

## 4. Modelo de datos

```
categories        id, name, slug, position
products          id, name, slug, description, category_id,
                  price (int COP), sale_price (int, null),
                  active (bool), created_at
product_images    id, product_id, url, position
variants          id, product_id, size, color_name, color_hex,
                  stock (int, CHECK >= 0), sku (null)
                  UNIQUE(product_id, size, color_name)
orders            id, code (OFF-0001), customer_name, customer_phone,
                  status: pending | confirmed | cancelled,
                  total (int), created_at, confirmed_at, cancelled_at
order_items       id, order_id, variant_id (null si se elimina),
                  product_name, size, color_name, unit_price, qty
stock_movements   id, variant_id, delta, reason:
                  order_confirmed | order_cancelled | manual,
                  order_id (null), created_at
admin_users       id, email, password_hash
settings          (1 fila) whatsapp_number, store_name, low_stock_threshold (default 3)
rate_limits       key, count, window_start  (para pedidos y login)
```

**Reglas**
- Precios en enteros COP. Precio efectivo = `sale_price` si existe, si no `price`; se congela en `order_items.unit_price` al crear el pedido.
- `order_items` guarda snapshot (nombre, talla, color, precio). Editar o borrar productos no altera ventas pasadas; las métricas se calculan sobre este snapshot.
- Productos o variantes con ventas no se eliminan: productos pasan a `active = false`, variantes quedan en stock 0.
- Tallas y colores son libres por producto, con sugerencias (XS–XXL) en el formulario admin.
- Código de pedido secuencial `OFF-0001` generado con una secuencia de Postgres.

**Estados del pedido**
- `pending → confirmed`: valida y descuenta stock.
- `confirmed → cancelled`: devuelve stock.
- `pending → cancelled`: no toca stock.
- `cancelled → *` no permitido (se crea un pedido nuevo).

## 5. Flujo del pedido

1. **Carrito** en `localStorage` (`{variantId, qty}`). Al abrirlo se consultan precios y stock vigentes; se ajusta y avisa si hubo cambios. qty ≤ stock.
2. **Checkout**: nombre + teléfono, nota "el envío se acuerda por WhatsApp", botón "Pedir por WhatsApp".
3. **`createOrder`** (Server Action): ignora precios del cliente, recarga variantes, valida activas y `qty <= stock`, calcula total. En una transacción inserta `orders` (pending) + `order_items`. No toca stock. Rate limit por IP. Devuelve código y URL `wa.me`.
4. **WhatsApp**: redirige a `https://wa.me/57<numero>?text=...` con mensaje:
   ```
   Hola OFFLINE, quiero hacer el pedido OFF-0001
   Nombre: Juan Pérez
   • Camiseta Oversize - Negro / M x2 - $179.800
   • Hoodie Basic - Gris / L x1 - $139.900
   Total productos: $319.700
   (envío por acordar)
   ```
   Se vacía el carrito y se muestra `/pedido/OFF-0001` con botón para reabrir el chat.
5. **Confirmar (admin)**, en una sola transacción: `SELECT ... FOR UPDATE` de las variantes del pedido; si alguna tiene `stock < qty` aborta sin cambios y muestra cuáles faltan; si no, descuenta, registra `stock_movements`, status `confirmed`, `confirmed_at`.
6. **Cancelar**: si estaba `confirmed`, devuelve stock y registra movimientos en la misma transacción.

**Límite consciente:** un pedido pendiente es una intención; si el cliente no envía el mensaje queda pendiente hasta que el admin lo cancele. No hay expiración automática en v1.

## 6. Panel admin

**Acceso**: `/admin/login`; middleware protege `/admin/*` y cada Server Action revalida la sesión. Sesión 7 días. Rate limit de login por IP. Admin inicial creado con script `seed` (credenciales por variables de entorno). Cambio de contraseña en ajustes.

**Rutas**
```
/admin                   dashboard
/admin/pedidos           lista; filtros por estado/fecha; búsqueda por código, nombre, teléfono
/admin/pedidos/[id]      detalle, confirmar/cancelar, botón "Abrir chat" (wa.me al cliente)
/admin/productos         lista, búsqueda, activar/ocultar
/admin/productos/nuevo   y /[id] edición
/admin/categorias        CRUD
/admin/ajustes           número de WhatsApp, nombre tienda, umbral stock bajo, contraseña
```

**Dashboard** (rango: hoy, 7d, 30d, mes, personalizado; ventas por `confirmed_at`, solo `confirmed`)
- Tarjetas: ventas COP, # pedidos confirmados, ticket promedio, pedidos pendientes (enlace).
- Gráfico de ventas por día.
- Top 5 productos por unidades e ingreso.
- Alertas: variantes con stock ≤ umbral y agotadas.

**Productos**: formulario único (datos, categoría, precio, oferta, activo); subida de varias fotos a Blob con reorden (la primera es la principal); variantes en grilla talla × color con "generar combinaciones" y ajuste rápido de stock en línea. Ajustes manuales quedan en `stock_movements`.

**Pedidos**: detalle con datos del cliente, ítems (snapshot), stock actual por variante y fechas. Confirmar/cancelar con diálogo de confirmación.

## 7. Tienda pública

```
/                  home: hero, categorías, novedades
/tienda            grilla + filtros (categoría, talla, color, precio, oferta), búsqueda, orden
/producto/[slug]   galería, selector talla/color (agotados deshabilitados), precio/oferta, agregar
/carrito           resumen y ajustes por stock/precio
/checkout          nombre + teléfono → WhatsApp
/pedido/[code]     confirmación
```

- Server Components, mobile-first, SEO (metadata y Open Graph por producto), `next/image`.
- Filtros por query params (URL compartible).
- Caché con `revalidateTag`, invalidada al editar productos o confirmar/cancelar pedidos.
- Elegir un color muestra solo las tallas disponibles de ese color.
- Dirección visual (minimalista, de marca de ropa) se define en la implementación.

## 8. Estructura del repo

```
src/
  app/
    (store)/        páginas públicas
    admin/          panel (login fuera del layout protegido)
    api/            solo si hace falta (upload a Blob)
  db/               schema.ts, client.ts, migrations/, seed.ts
  server/           orders.ts (createOrder, confirmOrder, cancelOrder),
                    catalog.ts, stats.ts, auth.ts, ratelimit.ts
  components/       ui/, store/, admin/
  lib/              money.ts (COP), whatsapp.ts, validators (zod)
```

Las Server Actions y páginas son capas finas; la lógica de negocio (stock, estados, totales) vive en `server/` y es testeable.

## 9. Errores

- `zod` en cada Server Action.
- Errores esperados (sin stock, variante inactiva, transición inválida) devuelven `{ok:false, error}` y se muestran en UI; los inesperados van a `error.tsx`.
- Crear, confirmar y cancelar son transacciones: todo o nada.
- Subidas: máx. 5 MB, solo jpg/png/webp.

## 10. Pruebas

- **Vitest** sobre `server/orders.ts` con Postgres real (DB de prueba o PGlite): confirmar descuenta; stock insuficiente aborta sin cambios; cancelar confirmado devuelve stock; doble confirmación no descuenta dos veces; dos confirmaciones concurrentes por la última unidad (una gana, otra falla).
- Unitarias de `whatsapp.ts` y `money.ts`.
- **Playwright**: e2e cliente (carrito → pedido pendiente) y admin (login → confirmar → stock baja).

## 11. Fuera de alcance (v1)

Pagos en línea, cuentas de cliente, cupones, emails, múltiples admins/roles, expiración de pendientes, cálculo de envíos, colecciones/destacados, exportar CSV.

## 12. Despliegue

Proyecto en Vercel con Neon y Blob añadidos desde Marketplace (variables de entorno inyectadas). Migraciones con `drizzle-kit`; seed del admin una sola vez.
