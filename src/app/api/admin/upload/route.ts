import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "@/db/client";
import { readSession } from "@/server/auth";
import { addImage } from "@/server/products";

const MAX = 4 * 1024 * 1024;
const OK = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  if (!(await readSession((await cookies()).get("offline_admin")?.value))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const productId = Number(fd.get("productId"));
  const files = fd.getAll("files").filter((f): f is File => f instanceof File);
  if (!productId || files.length === 0) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  for (const f of files) {
    if (!OK.has(f.type)) return NextResponse.json({ error: `${f.name}: solo jpg, png o webp` }, { status: 400 });
    if (f.size > MAX) return NextResponse.json({ error: `${f.name}: máximo 4 MB` }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Falta BLOB_READ_WRITE_TOKEN" }, { status: 500 });
  }
  const db = getDb();
  try {
    for (const f of files) {
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const blob = await put(`products/${productId}/${Date.now()}-${safeName}`, f, { access: "public", addRandomSuffix: true });
      await addImage(db, productId, blob.url);
    }
  } catch {
    return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 500 });
  }
  revalidateTag("catalog");
  revalidatePath("/admin/productos");
  return NextResponse.json({ ok: true });
}
