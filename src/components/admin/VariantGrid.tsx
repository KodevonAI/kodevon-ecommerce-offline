"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SIZE_SUGGESTIONS, sortSizes } from "@/lib/sizes";
import { generateVariantsAction, removeVariantAction, setStockAction } from "@/app/admin/productos/actions";

type Result = { error?: string; ok?: string } | undefined;
export type VariantRowData = { id: number; size: string; colorName: string; colorHex: string; stock: number };

function GenerateForm({ productId }: { productId: number }) {
  const [state, action, pending] = useActionState<Result, FormData>(generateVariantsAction.bind(null, productId), undefined);
  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tallas</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {sortSizes(SIZE_SUGGESTIONS).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="size" value={s} className="size-4" /> {s}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="extraSizes">Otras tallas (separadas por coma, ej. 28, 30, 32)</Label>
        <Input id="extraSizes" name="extraSizes" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="colors">Colores (uno por línea: nombre:#hex)</Label>
        <Textarea id="colors" name="colors" rows={3} placeholder={"Negro:#000000\nBlanco:#ffffff"} />
      </div>
      <p role={state?.error ? "alert" : "status"} className={`min-h-5 text-sm ${state?.error ? "text-red-600" : "text-green-700"}`}>
        {state?.error ?? state?.ok}
      </p>
      <Button type="submit" disabled={pending}>{pending ? "Generando..." : "Generar combinaciones"}</Button>
    </form>
  );
}

function StockCell({ v, threshold }: { v: VariantRowData; threshold: number }) {
  const [state, action, pending] = useActionState<Result, FormData>(setStockAction.bind(null, v.id), undefined);
  const low = v.stock <= threshold;
  return (
    <>
      <TableCell className={low ? "font-semibold text-red-600" : ""}>
        {v.stock}
        {low && <span className="ml-1 text-xs font-normal">(bajo)</span>}
      </TableCell>
      <TableCell>
        <form action={action} className="flex items-center gap-1">
          {/* "+" va primero en el DOM: Enter suma; el orden visual se mantiene con flex order */}
          <Button type="submit" name="dir" value="1" variant="outline" size="sm" className="order-3" disabled={pending} aria-label="Sumar stock">+</Button>
          <Button type="submit" name="dir" value="-1" variant="outline" size="sm" className="order-1" disabled={pending} aria-label="Restar stock">-</Button>
          <Input name="delta" type="number" min={1} step={1} defaultValue={1} className="order-2 w-16" aria-label="Cantidad" />
        </form>
        {state?.error && <p role="alert" className="mt-1 text-xs text-red-600">{state.error}</p>}
      </TableCell>
    </>
  );
}

export function VariantGrid({
  productId,
  variants,
  threshold,
}: {
  productId: number;
  variants: VariantRowData[];
  threshold: number;
}) {
  const order = new Map(sortSizes([...new Set(variants.map((v) => v.size))]).map((s, i) => [s, i]));
  const sorted = [...variants].sort(
    (a, b) => a.colorName.localeCompare(b.colorName, "es") || (order.get(a.size) ?? 0) - (order.get(b.size) ?? 0),
  );
  return (
    <div className="space-y-6">
      <GenerateForm productId={productId} />
      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-500">Aún no hay variantes.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Color</TableHead>
                <TableHead>Talla</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Ajustar</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span className="inline-block size-4 rounded-full border border-neutral-300" style={{ backgroundColor: v.colorHex }} aria-hidden />
                      {v.colorName}
                    </span>
                  </TableCell>
                  <TableCell>{v.size}</TableCell>
                  <StockCell v={v} threshold={threshold} />
                  <TableCell>
                    <form action={removeVariantAction}>
                      <input type="hidden" name="id" value={v.id} />
                      <Button type="submit" variant="outline" size="sm">Eliminar</Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
