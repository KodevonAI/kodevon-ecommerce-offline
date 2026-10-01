import { asc } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db/client";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { getProductEditData } from "@/server/products";
import { getSettings } from "@/server/settings";
import { ProductEditor, type ProductEditorInitial } from "@/components/admin/ProductEditor";

const EMPTY: ProductEditorInitial = {
  name: "", description: "", categoryId: null, price: "", salePrice: "", active: true,
  colorName: "", colorHex: "#000000", images: [], rows: [],
};

export default async function NuevoProductoPage({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  await requireAdmin();
  const desdeRaw = (await searchParams).desde;
  const desde = desdeRaw && /^\d{1,9}$/.test(desdeRaw) ? Number(desdeRaw) : null;
  const db = getDb();
  const [cats, settings, source] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position), asc(categories.name)),
    getSettings(db),
    desde && desde > 0 ? getProductEditData(db, desde) : Promise.resolve(null),
  ]);
  const initial: ProductEditorInitial = source
    ? {
        name: source.product.name,
        description: source.product.description,
        categoryId: source.product.categoryId,
        price: source.product.price,
        salePrice: source.product.salePrice ?? "",
        active: true,
        colorName: "",
        colorHex: "#000000",
        images: [],
        modelId: source.product.modelId,
        rows: source.variants.map((v) => ({ size: v.size, stock: 0 })),
      }
    : EMPTY;
  const back = source ? `/admin/productos/${source.product.id}` : "/admin/productos";
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={back} className="text-sm text-neutral-600 hover:text-neutral-900">
          ← {source ? source.product.name : "Productos"}
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900">
          {source ? `Nuevo color de ${source.product.name}` : "Nuevo producto"}
        </h1>
        <p className="text-sm text-neutral-500">
          {source
            ? "Copiamos nombre, descripción, categoría, precios y tallas (con stock 0). Elige el color y sube sus fotos."
            : "Completa los datos, el color, las fotos y las tallas con su stock. Todo se guarda de una vez."}
        </p>
      </div>
      <ProductEditor mode="new" id={null} categories={cats} threshold={settings.lowStockThreshold} initial={initial} />
    </div>
  );
}
