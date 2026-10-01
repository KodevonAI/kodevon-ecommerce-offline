import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/db/client";
import { categories, productImages, products, variants } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { getSettings } from "@/server/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "@/components/admin/ProductForm";
import { ImageManager } from "@/components/admin/ImageManager";
import { VariantGrid } from "@/components/admin/VariantGrid";

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const db = getDb();
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p) notFound();
  const [cats, images, vs, settings] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position), asc(categories.name)),
    db.select({ id: productImages.id, url: productImages.url }).from(productImages)
      .where(eq(productImages.productId, id)).orderBy(asc(productImages.position), asc(productImages.id)),
    db.select({ id: variants.id, size: variants.size, colorName: variants.colorName, colorHex: variants.colorHex, stock: variants.stock })
      .from(variants).where(eq(variants.productId, id)),
    getSettings(db),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/productos" className="text-sm text-neutral-600 hover:text-neutral-900">← Productos</Link>
        <h1 className="text-2xl font-semibold text-neutral-900">{p.name}</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Datos</CardTitle></CardHeader>
        <CardContent>
          <ProductForm
            id={id}
            categories={cats}
            initial={{ name: p.name, description: p.description, categoryId: p.categoryId, price: p.price, salePrice: p.salePrice, active: p.active }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Fotos</CardTitle></CardHeader>
        <CardContent><ImageManager productId={id} images={images} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Variantes y stock</CardTitle></CardHeader>
        <CardContent><VariantGrid productId={id} variants={vs} threshold={settings.lowStockThreshold} /></CardContent>
      </Card>
    </div>
  );
}
