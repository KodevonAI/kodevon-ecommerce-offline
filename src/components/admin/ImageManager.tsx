"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moveImageAction, removeImageAction } from "@/app/admin/productos/actions";

type Img = { id: number; url: string };

export function ImageManager({ productId, images }: { productId: number; images: Img[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.set("productId", String(productId));
      files.forEach((f) => body.append("files", f));
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo subir la imagen");
      } else {
        router.refresh();
      }
    } catch {
      setError("Error de red al subir la imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="files">Subir fotos (jpg, png o webp, máx. 4 MB c/u)</Label>
        <Input
          id="files"
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={upload}
          disabled={uploading}
        />
        <p role={error ? "alert" : "status"} className={`min-h-5 text-sm ${error ? "text-red-600" : "text-neutral-500"}`}>
          {error ?? (uploading ? "Subiendo..." : "")}
        </p>
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-neutral-500">Aún no hay fotos.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="space-y-2 rounded-lg border border-neutral-200 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded object-cover" />
              {i === 0 && <span className="text-xs font-medium text-neutral-700">Principal</span>}
              <div className="flex gap-1">
                <form action={moveImageAction}>
                  <input type="hidden" name="id" value={img.id} />
                  <input type="hidden" name="dir" value="up" />
                  <Button type="submit" variant="outline" size="sm" disabled={i === 0} aria-label="Mover a la izquierda">←</Button>
                </form>
                <form action={moveImageAction}>
                  <input type="hidden" name="id" value={img.id} />
                  <input type="hidden" name="dir" value="down" />
                  <Button type="submit" variant="outline" size="sm" disabled={i === images.length - 1} aria-label="Mover a la derecha">→</Button>
                </form>
                <form action={removeImageAction} className="ml-auto">
                  <input type="hidden" name="id" value={img.id} />
                  <Button type="submit" variant="outline" size="sm">Eliminar</Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
