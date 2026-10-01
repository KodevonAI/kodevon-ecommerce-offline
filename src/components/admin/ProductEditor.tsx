"use client";
import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/admin/ColorPicker";
import { PhotoUploader } from "@/components/admin/PhotoUploader";
import { SizeStockEditor, type SizeRow } from "@/components/admin/SizeStockEditor";
import { saveProductFull } from "@/app/admin/productos/actions";

type Result = { error?: string; ok?: string } | undefined;

export type ProductEditorInitial = {
  name: string;
  description: string;
  categoryId: number | null;
  price: number | "";
  salePrice: number | "";
  active: boolean;
  colorName: string;
  colorHex: string;
  images: string[];
  modelId?: string;
  rows: SizeRow[];
};

/**
 * Tras un ajuste de stock (+/−), archivar/reactivar o guardar, el servidor vuelve a renderizar la página con
 * datos nuevos. Solo se adoptan los datos que pueden cambiar fuera del formulario: stock e id de tallas ya
 * guardadas y el estado activo. Lo demás que el usuario esté editando no se pisa.
 */
function mergeServerRows(local: SizeRow[], server: SizeRow[]): SizeRow[] {
  const bySize = new Map(server.map((r) => [r.size, r]));
  return local.map((r) => {
    const s = bySize.get(r.size);
    return s?.variantId !== undefined ? { ...r, variantId: s.variantId, stock: s.stock } : r;
  });
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ProductEditor({ mode, id, categories, threshold, initial, notice }: {
  mode: "new" | "edit";
  id: number | null;
  categories: { id: number; name: string }[];
  threshold: number;
  initial: ProductEditorInitial;
  /** Mensaje inicial (p. ej. "Producto creado") mostrado hasta la primera acción. */
  notice?: string;
}) {
  const formId = useId();
  const [state, action, pending] = useActionState<Result, FormData>(saveProductFull.bind(null, id), undefined);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState<number | null>(initial.categoryId);
  const [price, setPrice] = useState(String(initial.price));
  const [salePrice, setSalePrice] = useState(String(initial.salePrice));
  const [active, setActive] = useState(initial.active);
  const [color, setColor] = useState({ colorName: initial.colorName, colorHex: initial.colorHex });
  const [images, setImages] = useState(initial.images);
  const [rows, setRows] = useState<SizeRow[]>(initial.rows);
  const [uploading, setUploading] = useState(false);

  // Sincronización con datos nuevos del servidor (patrón "estado derivado del prop anterior").
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    if (prevInitial.active !== initial.active) setActive(initial.active);
    setRows((r) => mergeServerRows(r, initial.rows));
  }

  const payload = JSON.stringify({
    name,
    description,
    categoryId,
    price: Number(price),
    salePrice: salePrice.trim() === "" ? null : Number(salePrice),
    active,
    colorName: color.colorName,
    colorHex: color.colorHex,
    modelId: initial.modelId,
    images,
    variants: rows.map(({ size, stock }) => ({ size: size.trim().toUpperCase(), stock: Number.isFinite(stock) ? stock : 0 })),
  });

  const message = state?.error ?? state?.ok ?? (state === undefined ? notice : undefined);
  const isError = Boolean(state?.error);

  return (
    <div className="space-y-6 pb-4">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Datos</CardTitle>
              <CardDescription>Lo que verá el cliente en la tienda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required
                  form={formId} placeholder="Ej. Camiseta básica" />
                <p className="text-xs text-neutral-500">Sin el color: el color va aparte y cada color es un producto.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)}
                  maxLength={4000} rows={4} placeholder="Material, horma, cuidados..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoría</Label>
                <select id="categoryId" value={categoryId ?? ""} className={selectClass}
                  onChange={(e) => setCategoryId(e.target.value === "" ? null : Number(e.target.value))}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio (COP)</Label>
                  <Input id="price" type="number" inputMode="numeric" min={1} step={1} required form={formId}
                    value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ej. 59900" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salePrice">Precio de oferta (opcional)</Label>
                  <Input id="salePrice" type="number" inputMode="numeric" min={1} step={1} form={formId}
                    max={Number(price) > 1 ? Number(price) - 1 : undefined}
                    value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                  <p className="text-xs text-neutral-500">Debe ser menor al precio. Déjalo vacío si no hay oferta.</p>
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="mt-0.5 size-4" />
                <span>
                  Activo
                  <span className="block text-xs text-neutral-500">Visible en la tienda. Desmárcalo para ocultarlo sin borrarlo.</span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tallas y stock</CardTitle>
              <CardDescription>Elige las tallas disponibles en este color y su stock.</CardDescription>
            </CardHeader>
            <CardContent>
              <SizeStockEditor rows={rows} onChange={setRows} threshold={threshold} formId={formId} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Color</CardTitle>
              <CardDescription>Cada color es un producto con sus propias fotos y stock.</CardDescription>
            </CardHeader>
            <CardContent>
              <ColorPicker colorName={color.colorName} colorHex={color.colorHex} onChange={setColor} formId={formId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fotos</CardTitle>
              <CardDescription>{mode === "new" ? "Súbelas ahora: se guardan junto con el producto." : "Fotos de este color."}</CardDescription>
            </CardHeader>
            <CardContent>
              <PhotoUploader urls={images} onChange={setImages} onBusyChange={setUploading} />
            </CardContent>
          </Card>
        </div>
      </div>

      <form
        id={formId}
        action={action}
        className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border"
      >
        <input type="hidden" name="payload" value={payload} />
        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        <p role={isError ? "alert" : "status"} className={`text-sm ${isError ? "text-red-600" : "text-green-700"}`}>
          {uploading ? <span className="text-neutral-500">Espera a que terminen de subir las fotos...</span> : message}
        </p>
      </form>
    </div>
  );
}
