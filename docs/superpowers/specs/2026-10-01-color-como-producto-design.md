# OFFLINE — Color como producto, carga completa y eliminación: diseño

Fecha: 2026-10-01
Extiende: `2026-09-30-offline-ecommerce-design.md` (modelo de datos §4, admin §6, tienda §7).

## 1. Objetivo y decisiones acordadas

El administrador necesita:

1. **Eliminar productos** cargados por error o que ya no se venden.
2. **Cargar toda la información de un producto antes de guardarlo** (datos, color, fotos, tallas y stock), en un solo paso.
3. Elegir el **color con un selector y un gotero**, no con un código hexadecimal; el valor se fija solo.
4. Tratar **cada color como un producto distinto**: la blusa roja y la blusa negra son dos productos del mismo modelo, y cambiar de color en la tienda cambia de producto.

| Tema | Decisión |
|---|---|
| Eliminar | Se borra de verdad solo un producto que **nunca tuvo pedidos** (ningún `order_items` apunta a sus variantes). Si los tiene, solo se puede **archivar** (`active = false`) y reactivar. |
| Color | Un producto tiene **un solo color** (nombre + valor). Las variantes pasan a ser **talla + stock**. |
| Agrupación | Los productos del mismo modelo comparten `model_id`. En la tienda se enlazan con círculos de color que **navegan al producto hermano**. |
| Catálogo | Cada color es su **propia tarjeta**, con los círculos de los demás colores del modelo. |
| Carga | Una sola pantalla; **nada se guarda hasta pulsar Guardar**; el producto, sus fotos y sus variantes se crean en **una transacción**. |
| Gotero | `<input type="color">` + botón de gotero (`EyeDropper` API de Chrome/Edge; si no existe, el botón no aparece). El **nombre del color se propone solo** y es editable. |
| Datos existentes | La migración convierte cada producto existente tomando el color de sus variantes. Si algún producto tiene **más de un color** en sus variantes, la migración **se detiene con un error claro** en lugar de convertirlo mal. |

## 2. Modelo de datos

### `products` (cambios)
- `color_name text not null default ''`
- `color_hex text not null default '#000000'` (validado `^#[0-9a-fA-F]{6}$` en el servidor)
- `model_id text not null` — identificador del grupo de colores. Productos nuevos: `crypto.randomUUID()`. Migración: `'m-' || id` para los existentes.
- Índice `products_model_id_idx (model_id)`.
- El **slug** incluye el color: `slugify(name + " " + color_name)`, con sufijo numérico si colisiona (mismo mecanismo de hoy).
- El `name` es el mismo en todo el grupo ("Blusa Basic"); la interfaz muestra "Blusa Basic · Rojo".

### `variants` (cambios)
- Dejan de usarse `color_name` y `color_hex`. En esta entrega **no se eliminan** (expand/contract): se les pone `DEFAULT ''` para que el código nuevo inserte sin ellas, y una migración posterior las quita.
- Nuevo índice único `variants_product_size_unique (product_id, size)`. El índice viejo `(product_id, size, color_name)` se conserva hasta la limpieza posterior.

### `order_items`
Sin cambios. `color_name` y `size` siguen siendo copia del momento del pedido; `createOrder` toma el color de `products.color_name`.

### Migración `0002` (solo añade; segura con datos)
1. **Chequeo previo:** si existe un producto con variantes de más de un `color_name` distinto, `RAISE EXCEPTION` con un mensaje en español que nombra los productos ("Divide estos productos por color antes de migrar: …"). No se modifica nada.
2. Añade las columnas nuevas, copia a `products.color_name/color_hex` el color de sus variantes (el único que hay), `model_id = 'm-' || id`.
3. Pone `DEFAULT ''` a `variants.color_name`.
4. Crea los índices nuevos.

Es compatible hacia atrás: el código desplegado antes de la migración sigue funcionando después de ella, y viceversa, porque no se quita ninguna columna.

## 3. Servidor (`src/server`, funciones puras que reciben `db`)

- `createProductFull(db, input)` → `{ id, slug }`. Una transacción que inserta producto + fotos + variantes (+ un `stock_movement` `manual` con delta = stock inicial por variante con stock > 0). `input`: `{ name, description, categoryId, price, salePrice, active, colorName, colorHex, modelId?, images: string[], variants: { size, stock }[] }`. `modelId` ausente → nuevo; presente → el producto se une a ese grupo.
- `updateProductFull(db, id, input)`: actualiza datos y color (el slug **no cambia**) y **reemplaza** el conjunto de fotos por las recibidas, en una transacción. Tallas: añade las nuevas con stock 0 (o el stock indicado, con movimiento) y quita las ausentes **solo si no tienen pedidos** (si las tienen, quedan con stock 0, como hoy). El stock de tallas existentes **no se edita aquí**: se ajusta con `adjustStock` para conservar historial.
- `deleteProduct(db, id)` → `"deleted" | "has_orders" | "not_found"`. Transacción: si hay algún `order_items` cuyo `variant_id` pertenezca al producto → `has_orders` sin cambios. Si no, borra el producto (cascada a variantes, fotos y `stock_movements`) y devuelve las URLs de sus fotos para que el llamador intente borrarlas de Blob (best effort, nunca falla la operación).
- Archivar/reactivar: el `toggleActive` existente.
- `nearestColorName(hex)` (`src/lib/colors.ts`, pura): nombre en español del color más cercano de una paleta curada (~30 colores: Negro, Blanco, Gris, Rojo, Vino, Rosa, Naranja, Amarillo, Verde, Verde oliva, Azul, Azul marino, Celeste, Morado, Beige, Café, Crema…) por distancia en espacio Lab.
- `catalog.ts`:
  - `listProducts` devuelve en cada `ProductCard` `colors: { slug, colorName, colorHex }[]` con los **demás** productos activos del mismo `model_id` (una consulta extra por página, agrupada por `model_id`, sin N+1). El filtro `color` usa `products.color_name`.
  - `getProductBySlug` devuelve `colorName`, `colorHex` y `siblings: { slug, colorName, colorHex, inStock }[]` (activos del mismo modelo, incluido el actual); `variants` ya no trae color.
  - `getFilterOptions().colors` sale de `products`.
  - `getCartLines` toma el color del producto.
- `createOrder`: `colorName` del snapshot = `products.color_name`; la unicidad/validaciones no cambian.
- `stats.topProducts`: agrupa por `product_name` **y** `color_name` (de `order_items`) y devuelve `name` = "Nombre · Color".

## 4. Admin

### Pantalla de producto (`/admin/productos/nuevo` y `/admin/productos/[id]`)
Un único formulario con cuatro bloques:

1. **Datos:** nombre, descripción, categoría, precio, precio de oferta, activo.
2. **Color:** selector de color nativo + botón "Gotero" (solo si `window.EyeDropper` existe). Al cambiar el color se rellena el nombre con `nearestColorName` mientras el usuario no lo haya editado a mano. Se muestra una muestra grande del color.
3. **Fotos:** selección múltiple; cada archivo se sube por `POST /api/admin/upload` (una petición por archivo, como hoy) y se muestra su miniatura; reordenar, quitar y marcar la primera como principal. **No se crea nada en la base hasta Guardar.**
4. **Tallas y stock:** chips para `SIZE_SUGGESTIONS` y un campo para tallas personalizadas; cada talla elegida muestra un campo de stock inicial (entero ≥ 0). En edición, las tallas existentes muestran su stock actual de solo lectura con el control `+/-` de siempre (`adjustStock`).

`Guardar` envía todo en una Server Action (`saveProductFull`) que valida con zod (colores `^#[0-9a-fA-F]{6}$`, tallas no vacías sin duplicados normalizados, stock entero ≥ 0, **URLs de fotos solo de `https://*.public.blob.vercel-storage.com/`**) y llama a `createProductFull` / `updateProductFull`. Errores esperados vuelven como mensajes en pantalla sin perder lo escrito.

### Subida de fotos
`/api/admin/upload` pasa a ser **solo subida**: valida sesión, tipo (jpg/png/webp), tamaño (≤ 4 MB) y extensión coherente, sube a Blob y **devuelve la URL**; ya no recibe `productId` ni escribe en la base. Las imágenes se asocian al guardar.

### "Agregar otro color"
Botón en el detalle de un producto → `/admin/productos/nuevo?desde=<id>`: precarga nombre, descripción, categoría, precio, oferta y tallas (stock en 0) y fija el mismo `model_id`; el administrador solo elige color, fotos y stock.

### Eliminar y archivar
- Botón **Eliminar** (lista y detalle) con diálogo de confirmación cuando el producto no tiene pedidos; si los tiene, el botón es **Archivar** (o **Reactivar** si ya está archivado) y el diálogo explica que el historial se conserva.
- `deleteProductAction` valida sesión (`requireAdmin`), llama a `deleteProduct`, intenta borrar las fotos de Blob con `@vercel/blob` `del` (errores ignorados y registrados) y revalida `catalog` y las rutas admin.
- La lista muestra el círculo de color de cada producto y la etiqueta "Archivado".

## 5. Tienda

- **Página de producto:** círculos de color = `siblings`; el actual va marcado; pulsar otro hace `router.push` a su slug, conservando la talla elegida si existe en el destino. Los colores sin stock se muestran atenuados pero navegables. Solo queda el selector de **talla**.
- **Catálogo:** cada producto es una tarjeta; muestra sus círculos `colors` (máx. 5 y "+N").
- **Carrito y WhatsApp:** "Nombre · Color · Talla", igual que hoy.
- **Modo demo:** los datos de ejemplo pasan al nuevo modelo (cada color un producto, con `model_id`).
- **Caché:** toda mutación de productos sigue invalidando el tag `catalog`.

## 6. Seguridad y errores

- Todas las páginas, acciones y rutas nuevas llaman a `requireAdmin()`/`readSession` (el middleware no es frontera de autorización).
- Las URLs de fotos que llegan al guardar se validan contra el patrón de Blob (no se aceptan URLs arbitrarias).
- Errores esperados (slug duplicado imposible por sufijo, talla duplicada, `has_orders` al borrar) devuelven resultado tipado; los inesperados van a `error.tsx`.
- Borrar un producto no puede dejar un pedido sin su historial: `order_items` conserva copia de nombre, talla, color y precio, y `variant_id` pasa a `null` por la restricción existente (que nunca se alcanza porque `deleteProduct` rechaza productos con pedidos).

## 7. Pruebas

- **Unitarias (Vitest + PGlite):**
  - `createProductFull` crea producto + fotos + variantes + movimientos de stock en una transacción, y **no deja nada** si falla (p. ej. talla duplicada).
  - `updateProductFull` conserva el slug, reemplaza fotos, no borra tallas con pedidos.
  - `deleteProduct`: borra y devuelve las URLs cuando no hay pedidos; `has_orders` sin cambios cuando los hay (también con pedido cancelado); `not_found`.
  - Grupos de color: dos productos con el mismo `model_id` aparecen como `siblings`/`colors` entre sí y no con otros modelos; productos archivados no aparecen.
  - `listProducts`/`getProductBySlug`/`getFilterOptions`/`getCartLines` con el nuevo modelo; filtro por color.
  - `createOrder` toma el color del producto; el snapshot es correcto; confirmar/cancelar sin cambios de comportamiento.
  - `nearestColorName` para colores representativos y bordes (blanco, negro, grises, hex en mayúsculas/minúsculas).
  - Migración 0002: con datos de un solo color por producto convierte bien; con un producto de dos colores **falla con el mensaje esperado** y no modifica nada.
  - `stats.topProducts` separa colores.
  - Validadores zod del formulario (hex, URL de Blob, tallas).
- **E2E demo (Playwright):** en la página de producto, pulsar otro círculo de color cambia a otro producto (URL y título distintos); el catálogo muestra una tarjeta por color; el flujo de carrito/checkout sigue pasando.
- La e2e con base de datos real (gated por `E2E_DATABASE_URL`) se actualiza al nuevo modelo y sigue sin poder ejecutarse en este entorno.

## 8. Despliegue

1. Verificar en Neon, antes de migrar, que ningún producto tiene variantes de más de un color (consulta de lectura); si hay alguno, resolverlo con el administrador.
2. Aplicar la migración `0002` en Neon (`DATABASE_URL=… npm run db:migrate`). Es solo-aditiva: el sitio actual sigue funcionando.
3. Subir el código a `main`; Vercel despliega solo.
4. Más adelante, una migración de limpieza elimina `variants.color_name`/`color_hex` y el índice viejo.

## 9. Fuera de alcance

Renombrar o cambiar el color de un grupo completo, administrar grupos aparte (mover un producto a otro modelo), fotos por talla, importación masiva, deshacer una eliminación, y la limpieza de las columnas viejas de color (migración posterior).
