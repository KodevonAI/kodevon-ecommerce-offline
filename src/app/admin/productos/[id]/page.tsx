import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/db/client";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { getProductEditData, hasOrders } from "@/server/products";
import { getSettings } from "@/server/settings";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ProductActions } from "@/components/admin/ProductActions";
import { ProductEditor } from "@/components/admin/ProductEditor";

export default async function EditarProductoPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const created = (await searchParams).creado === "1";
  const db = getDb();
  const data = await getProductEditData(db, id);
  if (!data) notFound();
  const [cats, settings, withOrders] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position), asc(categories.name)),
    getSettings(db),
    hasOrders(db, id),
  ]);
  const { product: p, images, variants, siblings } = data;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link href="/admin/productos" className="text-sm text-neutral-600 hover:text-neutral-900">← Productos</Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900">{p.name}</h1>
              {!p.active && <Badge variant="secondary">Archivado</Badge>}
            </div>
            <p className="flex items-center gap-2 text-sm text-neutral-600">
              <span className="inline-block size-4 rounded-full border border-neutral-300" style={{ backgroundColor: p.colorHex }} aria-hidden />
              {p.colorName}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <Link href={`/admin/productos/nuevo?desde=${id}`} className={buttonVariants({ variant: "outline" })}>
              Agregar otro color
            </Link>
            <ProductActions id={id} name={`${p.name} (${p.colorName})`} active={p.active} hasOrders={withOrders} size="default" />
          </div>
        </div>
        {siblings.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-500">Otros colores:</span>
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/admin/productos/${s.id}`}
                className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-neutral-700 hover:border-neutral-400"
              >
                <span className="inline-block size-3 rounded-full border border-neutral-300" style={{ backgroundColor: s.colorHex }} aria-hidden />
                {s.colorName}
                {!s.active && <span className="text-xs text-neutral-400">(Archivado)</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
      <ProductEditor
        mode="edit"
        id={id}
        categories={cats}
        threshold={settings.lowStockThreshold}
        notice={created ? "Producto creado. Ya puedes ajustar su stock o agregar otro color." : undefined}
        initial={{
          name: p.name,
          description: p.description,
          categoryId: p.categoryId,
          price: p.price,
          salePrice: p.salePrice ?? "",
          active: p.active,
          colorName: p.colorName,
          colorHex: p.colorHex,
          images: images.map((i) => i.url),
          modelId: p.modelId,
          rows: variants.map((v) => ({ size: v.size, stock: v.stock, variantId: v.id })),
        }}
      />
    </div>
  );
}
