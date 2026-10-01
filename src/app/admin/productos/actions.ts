"use server";
import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { products } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { adjustStock } from "@/server/orders";
import { createProductFull, deleteProduct, updateProductFull } from "@/server/products";
import { mapSaveError, parseProductPayload } from "@/lib/product-payload";

type Result = { error?: string; ok?: string } | undefined;

const refresh = () => {
  revalidateTag("catalog");
  revalidatePath("/admin/productos");
};

/** El `redirect()` de Next lanza una excepción con digest NEXT_REDIRECT: nunca debe tratarse como error de guardado. */
const isNextRedirect = (e: unknown) =>
  typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");

/** Borra fotos de Blob sin lanzar nunca: si falla, el producto ya quedó guardado/borrado y solo se registra. */
async function deleteBlobs(urls: string[]) {
  try {
    if (urls.length && process.env.BLOB_READ_WRITE_TOKEN) await del(urls);
  } catch (e) {
    console.error("No se pudieron borrar fotos de Blob", e);
  }
}

export async function saveProductFull(id: number | null, _: unknown, fd: FormData): Promise<Result> {
  await requireAdmin();
  if (id !== null && (!Number.isInteger(id) || id < 1)) return { error: "Producto inválido" };
  const parsed = parseProductPayload(String(fd.get("payload") ?? ""));
  if (!parsed.ok) return { error: parsed.error };
  const db = getDb();
  let createdId: number | null = null;
  try {
    if (id === null) {
      createdId = (await createProductFull(db, parsed.data)).id;
    } else {
      const updated = await updateProductFull(db, id, parsed.data);
      if (!updated) return { error: "El producto ya no existe" };
      refresh();
      revalidatePath(`/admin/productos/${id}`);
      await deleteBlobs(updated.removedImages);
      return { ok: "Cambios guardados" };
    }
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    console.error("Error al guardar producto", e);
    return { error: mapSaveError(e) };
  }
  refresh();
  redirect(`/admin/productos/${createdId}?creado=1`);
}

// `_prev` lo exige la firma de useActionState aunque no se use.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteProductAction(id: number, _prev: unknown): Promise<Result> {
  await requireAdmin();
  if (!Number.isInteger(id) || id < 1) return { error: "Producto inválido" };
  let r: Awaited<ReturnType<typeof deleteProduct>>;
  try {
    r = await deleteProduct(getDb(), id);
  } catch (e) {
    console.error("Error al eliminar producto", e);
    return { error: "No se pudo eliminar el producto" };
  }
  if (r.status === "has_orders") return { error: "Este producto tiene pedidos: no se puede eliminar, solo archivar." };
  if (r.status === "not_found") return { error: "El producto ya no existe" };
  await deleteBlobs(r.imageUrls);
  refresh();
  redirect("/admin/productos");
}

export async function setStockAction(variantId: number, _: unknown, fd: FormData): Promise<Result> {
  await requireAdmin();
  if (!Number.isInteger(variantId) || variantId < 1) return { error: "Talla inválida" };
  const amount = Math.abs(Math.trunc(Number(fd.get("delta") ?? 1)));
  const dir = Number(fd.get("dir")) < 0 ? -1 : 1;
  if (!Number.isInteger(amount) || amount < 1) return { error: "Cantidad inválida" };
  const r = await adjustStock(getDb(), variantId, amount * dir);
  if (!r.ok) {
    return { error: r.error.code === "insufficient_stock" ? "Stock insuficiente" : "No se pudo ajustar" };
  }
  refresh();
  revalidatePath("/admin/productos/[id]", "page");
  return { ok: `Stock: ${r.data.stock}` };
}

export async function toggleActive(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id < 1) return;
  await getDb().update(products).set({ active: fd.get("active") === "true" }).where(eq(products.id, id));
  refresh();
  revalidatePath(`/admin/productos/${id}`);
}
