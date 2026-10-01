"use server";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "@/db/client";
import { categories, products } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { categorySchema } from "@/lib/validators";
import { slugify } from "@/lib/slug";

export async function createCategory(_: unknown, fd: FormData) {
  await requireAdmin();
  const p = categorySchema.safeParse({ name: fd.get("name") });
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    await getDb().insert(categories).values({ name: p.data.name, slug: slugify(p.data.name) });
  } catch { return { error: "Ya existe una categoría con ese nombre" }; }
  revalidateTag("catalog"); revalidatePath("/admin/categorias");
  return { ok: "Creada" };
}

export async function deleteCategory(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const db = getDb();
  await db.update(products).set({ categoryId: null }).where(eq(products.categoryId, id));
  await db.delete(categories).where(eq(categories.id, id));
  revalidateTag("catalog"); revalidatePath("/admin/categorias");
}
