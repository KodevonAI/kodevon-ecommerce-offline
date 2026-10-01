import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function NuevoProductoPage() {
  await requireAdmin();
  const cats = await getDb().select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position), asc(categories.name));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Nuevo producto</h1>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Datos</CardTitle></CardHeader>
        <CardContent><ProductForm id={null} categories={cats} /></CardContent>
      </Card>
      <p className="text-sm text-neutral-500">Después de guardar podrás subir fotos y crear variantes.</p>
    </div>
  );
}
