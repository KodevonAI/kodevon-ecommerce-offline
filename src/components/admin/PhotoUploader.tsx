"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const MAX_PHOTOS = 12;

export function PhotoUploader({ urls, onChange, onBusyChange }: {
  urls: string[];
  onChange: (urls: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const busy = progress !== null;

  function setBusy(p: { done: number; total: number } | null) {
    setProgress(p);
    onBusyChange?.(p !== null);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const errors: string[] = [];
    const room = MAX_PHOTOS - urls.length;
    const files = picked.slice(0, Math.max(room, 0));
    if (files.length < picked.length) errors.push(`Máximo ${MAX_PHOTOS} fotos por producto`);
    setError(null);
    let current = urls;
    setBusy({ done: 0, total: files.length });
    // Un request por archivo: Vercel limita el cuerpo de la función a ~4.5 MB.
    for (const [i, f] of files.entries()) {
      try {
        const body = new FormData();
        body.append("files", f);
        const res = await fetch("/api/admin/upload", { method: "POST", body });
        const data = await res.json().catch(() => null);
        if (res.ok && typeof data?.urls?.[0] === "string") {
          current = [...current, data.urls[0]];
          onChange(current);
        } else {
          errors.push(
            typeof data?.error === "string"
              ? data.error
              : res.status === 413
                ? `${f.name}: El archivo supera el límite de la plataforma`
                : `${f.name}: No se pudo subir la imagen`,
          );
        }
      } catch {
        errors.push(`${f.name}: Error de red al subir la imagen`);
      }
      setBusy({ done: i + 1, total: files.length });
    }
    setError(errors.length ? errors.join(" · ") : null);
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= urls.length) return;
    const next = [...urls];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="files">Agregar fotos</Label>
        <Input
          id="files"
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={upload}
          disabled={busy || urls.length >= MAX_PHOTOS}
          className="h-auto py-1.5"
        />
        <p className="text-xs text-neutral-500">
          jpg, png o webp, máx. 4 MB cada una y hasta {MAX_PHOTOS} fotos. La primera es la principal; se guardan al pulsar Guardar.
        </p>
        <p role={error ? "alert" : "status"} className={`min-h-5 text-sm ${error ? "text-red-600" : "text-neutral-500"}`}>
          {error ?? (progress ? `Subiendo ${Math.min(progress.done + 1, progress.total)} de ${progress.total}...` : "")}
        </p>
      </div>
      {urls.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          Aún no hay fotos.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
          {urls.map((url, i) => (
            <li key={url} className="space-y-2 rounded-lg border border-neutral-200 bg-white p-2">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded object-cover" />
                {i === 0 && (
                  <span className="absolute top-1 left-1 rounded bg-neutral-900/80 px-1.5 py-0.5 text-xs font-medium text-white">
                    Principal
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="outline" size="sm" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Mover a la izquierda">←</Button>
                <Button type="button" variant="outline" size="sm" disabled={busy || i === urls.length - 1} onClick={() => move(i, 1)} aria-label="Mover a la derecha">→</Button>
                <Button type="button" variant="ghost" size="sm" className="ml-auto text-red-600 hover:text-red-700" disabled={busy}
                  onClick={() => onChange(urls.filter((_, k) => k !== i))}>
                  Quitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
