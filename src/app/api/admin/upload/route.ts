import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession } from "@/server/auth";
import { validateImageFile } from "@/lib/upload";

/** Solo sube a Blob y devuelve las URLs; el producto guarda sus fotos al pulsar "Guardar" en el editor. */
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
  const files = fd.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  for (const f of files) {
    const error = validateImageFile(f);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Falta BLOB_READ_WRITE_TOKEN" }, { status: 500 });
  }
  const urls: string[] = [];
  try {
    for (const f of files) {
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const blob = await put(`products/${Date.now()}-${safeName}`, f, { access: "public", addRandomSuffix: true, contentType: f.type });
      urls.push(blob.url);
    }
  } catch (e) {
    console.error("No se pudo subir la imagen", e);
    return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 500 });
  }
  return NextResponse.json({ urls });
}
