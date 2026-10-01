"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveProduct } from "@/app/admin/productos/actions";

type Result = { error?: string; ok?: string } | undefined;

export type ProductFormValues = {
  name: string;
  description: string;
  categoryId: number | null;
  price: number;
  salePrice: number | null;
  active: boolean;
};

export function ProductForm({
  id,
  categories,
  initial,
}: {
  id: number | null;
  categories: { id: number; name: string }[];
  initial?: ProductFormValues;
}) {
  const [state, action, pending] = useActionState<Result, FormData>(saveProduct.bind(null, id), undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={initial?.name} minLength={2} maxLength={120} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" name="description" defaultValue={initial?.description} maxLength={4000} rows={4} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="categoryId">Categoría</Label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={initial?.categoryId ?? ""}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Precio (COP)</Label>
          <Input id="price" name="price" type="number" inputMode="numeric" min={1} step={1} defaultValue={initial?.price} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salePrice">Precio de oferta (opcional)</Label>
          <Input id="salePrice" name="salePrice" type="number" inputMode="numeric" min={1} step={1} defaultValue={initial?.salePrice ?? ""} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="size-4" />
        Activo (visible en la tienda)
      </label>
      <p role={state?.error ? "alert" : "status"} className={`min-h-5 text-sm ${state?.error ? "text-red-600" : "text-green-700"}`}>
        {state?.error ?? state?.ok}
      </p>
      <Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar"}</Button>
    </form>
  );
}
