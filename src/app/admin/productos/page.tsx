import { asc, desc, eq, ilike, sql } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db/client";
import { categories, orderItems, productImages, products, variants } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { escapeLike } from "@/lib/like";
import { formatCop } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductActions } from "@/components/admin/ProductActions";

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = ((await searchParams).q ?? "").trim();
  const rows = await getDb()
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      salePrice: products.salePrice,
      active: products.active,
      colorName: products.colorName,
      colorHex: products.colorHex,
      category: categories.name,
      image: sql<string | null>`(select ${productImages.url} from ${productImages} where ${productImages.productId} = ${products.id} order by ${productImages.position} asc, ${productImages.id} asc limit 1)`,
      // Una sola subconsulta por fila (sin N+1): decide si se puede eliminar o solo archivar.
      hasOrders: sql<boolean>`exists(select 1 from ${orderItems} oi join ${variants} v on v.id = oi.variant_id where v.product_id = ${products.id})`,
      stock: sql<number>`coalesce((select sum(${variants.stock}) from ${variants} where ${variants.productId} = ${products.id}), 0)::int`,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(q ? ilike(products.name, `%${escapeLike(q)}%`) : undefined)
    .orderBy(desc(products.createdAt), asc(products.id));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Productos</h1>
        <Link href="/admin/productos/nuevo" className={buttonVariants()}>Nuevo producto</Link>
      </div>
      <form className="flex max-w-md gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar por nombre" aria-label="Buscar productos" />
        <Button type="submit" variant="outline">Buscar</Button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{q ? "Sin resultados." : "Aún no hay productos."}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Foto</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt="" className="size-12 rounded object-cover" />
                    ) : (
                      <div className="size-12 rounded bg-neutral-100" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/productos/${r.id}`} className="font-medium text-neutral-900 hover:underline">{r.name}</Link>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                      <span className="inline-block size-3 rounded-full border border-neutral-300" style={{ backgroundColor: r.colorHex }} aria-hidden />
                      {r.colorName}
                    </span>
                  </TableCell>
                  <TableCell>{r.category ?? "—"}</TableCell>
                  <TableCell>
                    {r.salePrice ? (
                      <>
                        <span className="font-medium">{formatCop(r.salePrice)}</span>{" "}
                        <span className="text-xs text-neutral-500 line-through">{formatCop(r.price)}</span>
                      </>
                    ) : formatCop(r.price)}
                  </TableCell>
                  <TableCell>{r.stock}</TableCell>
                  <TableCell>
                    <Badge variant={r.active ? "default" : "secondary"}>{r.active ? "Activo" : "Archivado"}</Badge>
                  </TableCell>
                  <TableCell>
                    <ProductActions id={r.id} name={`${r.name} (${r.colorName})`} active={r.active} hasOrders={r.hasOrders} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
