"use server";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { products } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { adjustStock } from "@/server/orders";
import {
  createProduct, generateVariants, moveImage, normalizeSizes, parseColorLines, removeImage, removeVariant, updateProduct,
} from "@/server/products";
import { productSchema } from "@/lib/validators";

type Result = { error?: string; ok?: string } | undefined;

const refresh = () => {
  revalidateTag("catalog");
  revalidatePath("/admin/productos");
};

const emptyToNull = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

export async function saveProduct(id: number | null, _: unknown, fd: FormData): Promise<Result> {
  await requireAdmin();
  const parsed = productSchema.safeParse({
    name: fd.get("name"),
    description: fd.get("description") ?? "",
    categoryId: emptyToNull(fd.get("categoryId")),
    price: fd.get("price"),
    salePrice: emptyToNull(fd.get("salePrice")),
    active: fd.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = getDb();
  if (id === null) {
    const created = await createProduct(db, parsed.data);
    refresh();
    redirect(`/admin/productos/${created.id}`);
  }
  await updateProduct(db, id, parsed.data);
  refresh();
  revalidatePath(`/admin/productos/${id}`);
  return { ok: "Guardado" };
}

export async function generateVariantsAction(productId: number, _: unknown, fd: FormData): Promise<Result> {
  await requireAdmin();
  const checked = fd.getAll("size").map(String);
  const extra = String(fd.get("extraSizes") ?? "").split(",");
  const sizes = normalizeSizes([...checked, ...extra]);
  const parsed = parseColorLines(String(fd.get("colors") ?? ""));
  if ("error" in parsed) return { error: parsed.error };
  const colors = parsed.colors;
  if (sizes.length === 0) return { error: "Elige al menos una talla" };
  if (colors.length === 0) return { error: "Agrega al menos un color (nombre:#hex)" };
  const created = await generateVariants(getDb(), productId, sizes, colors);
  refresh();
  revalidatePath(`/admin/productos/${productId}`);
  return { ok: created === 0 ? "Esas combinaciones ya existían" : `${created} combinaciones creadas` };
}

export async function setStockAction(variantId: number, _: unknown, fd: FormData): Promise<Result> {
  await requireAdmin();
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

export async function removeVariantAction(fd: FormData) {
  await requireAdmin();
  await removeVariant(getDb(), Number(fd.get("id")));
  refresh();
  revalidatePath("/admin/productos/[id]", "page");
}

export async function removeImageAction(fd: FormData) {
  await requireAdmin();
  await removeImage(getDb(), Number(fd.get("id")));
  refresh();
  revalidatePath("/admin/productos/[id]", "page");
}

export async function moveImageAction(fd: FormData) {
  await requireAdmin();
  const dir = fd.get("dir") === "down" ? "down" : "up";
  await moveImage(getDb(), Number(fd.get("id")), dir);
  refresh();
  revalidatePath("/admin/productos/[id]", "page");
}

export async function toggleActive(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  await getDb().update(products).set({ active: fd.get("active") === "true" }).where(eq(products.id, id));
  refresh();
}
