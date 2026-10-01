"use server";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "@/db/client";
import { categories, products } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { categorySchema } from "@/lib/validators";
import { slugify } from "@/lib/slug";

// Postgres 23505 = unique_violation; drizzle puede envolver el error original en `cause`.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export async function createCategory(_: unknown, fd: FormData) {
  await requireAdmin();
  const p = categorySchema.safeParse({ name: fd.get("name") });
  if (!p.success) return { error: p.error.issues[0].message };
  const slug = slugify(p.data.name);
  if (!slug) return { error: "Nombre inválido" };
  try {
    await getDb().insert(categories).values({ name: p.data.name, slug });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "Ya existe una categoría con ese nombre" };
    throw err;
  }
  revalidateTag("catalog"); revalidatePath("/admin/categorias");
  return { ok: "Creada" };
}

export async function deleteCategory(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await getDb().transaction(async (tx) => {
    await tx.update(products).set({ categoryId: null }).where(eq(products.categoryId, id));
    await tx.delete(categories).where(eq(categories.id, id));
  });
  revalidateTag("catalog"); revalidatePath("/admin/categorias");
}
