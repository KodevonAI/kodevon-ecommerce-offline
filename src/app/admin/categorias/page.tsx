import { asc, count, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories, products } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteCategory } from "./actions";
import { CategoryForm } from "./forms";

export default async function CategoriasPage() {
  await requireAdmin();
  const rows = await getDb()
    .select({ id: categories.id, name: categories.name, total: count(products.id) })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.position), asc(categories.name));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Categorías</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Categorías</CardTitle></CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-neutral-500">Aún no hay categorías.</p>
            ) : (
              <ul className="divide-y">
                {rows.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span className="text-sm">{c.name} <span className="text-neutral-500">({c.total} productos)</span></span>
                    <form action={deleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" variant="outline" size="sm">Eliminar</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Crear</CardTitle></CardHeader>
          <CardContent><CategoryForm /></CardContent>
        </Card>
      </div>
    </div>
  );
}
