"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SIZE_SUGGESTIONS, sortSizes } from "@/lib/sizes";
import { rowForAddedSize, type SizeRow } from "@/lib/size-rows";
import { setStockAction } from "@/app/admin/productos/actions";

type Result = { error?: string; ok?: string } | undefined;
export type { SizeRow };

const MAX_SIZE_LEN = 10;
const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();

/** Ajuste +/− del stock de una talla ya guardada (queda registrado como movimiento manual). */
function StockAdjust({ variantId }: { variantId: number }) {
  const [state, action, pending] = useActionState<Result, FormData>(setStockAction.bind(null, variantId), undefined);
  return (
    <div>
      <form action={action} className="flex items-center gap-1">
        {/* "+" va primero en el DOM: Enter suma; el orden visual se mantiene con flex order */}
        <Button type="submit" name="dir" value="1" variant="outline" size="sm" className="order-3" disabled={pending} aria-label="Sumar stock">+</Button>
        <Button type="submit" name="dir" value="-1" variant="outline" size="sm" className="order-1" disabled={pending} aria-label="Restar stock">−</Button>
        <Input name="delta" type="number" min={1} step={1} defaultValue={1} className="order-2 w-16" aria-label="Cantidad" />
      </form>
      {state?.error && <p role="alert" className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

export function SizeStockEditor({ rows, saved, onChange, threshold, formId }: {
  rows: SizeRow[];
  /** Filas tal como están guardadas en el servidor (para recuperar una talla quitada sin guardar). */
  saved: SizeRow[];
  onChange: (rows: SizeRow[]) => void;
  threshold: number;
  /** id del formulario del editor, para validar el stock inicial de tallas nuevas. */
  formId?: string;
}) {
  const [other, setOther] = useState("");
  const [otherError, setOtherError] = useState<string | null>(null);
  const has = (size: string) => rows.some((r) => r.size === size);
  const order = new Map(sortSizes(rows.map((r) => r.size)).map((s, i) => [s, i]));
  const sorted = [...rows].sort((a, b) => (order.get(a.size) ?? 0) - (order.get(b.size) ?? 0));
  const hasExisting = rows.some((r) => r.variantId !== undefined);

  const add = (size: string) => onChange([...rows, rowForAddedSize(size, saved)]);
  const remove = (size: string) => onChange(rows.filter((r) => r.size !== size));
  const toggle = (size: string) => (has(size) ? remove(size) : add(size));
  const setStock = (size: string, stock: number) => onChange(rows.map((r) => (r.size === size ? { ...r, stock } : r)));

  function addOther() {
    const s = normalize(other);
    if (!s) return;
    if (s.length > MAX_SIZE_LEN) return setOtherError(`Máximo ${MAX_SIZE_LEN} caracteres`);
    if (has(s)) return setOtherError(`La talla ${s} ya está en la lista`);
    add(s);
    setOther("");
    setOtherError(null);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">Tallas frecuentes</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tallas frecuentes">
          {sortSizes(SIZE_SUGGESTIONS).map((s) => {
            const on = has(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s)}
                className={`h-9 min-w-11 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="otherSize">Otra talla</Label>
        <div className="flex max-w-xs gap-2">
          <Input
            id="otherSize"
            value={other}
            maxLength={MAX_SIZE_LEN}
            placeholder="Ej. 28, 32, Única"
            onChange={(e) => { setOther(e.target.value); setOtherError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }}
          />
          <Button type="button" variant="outline" onClick={addOther}>Agregar</Button>
        </div>
        {otherError && <p role="alert" className="text-xs text-red-600">{otherError}</p>}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          Elige al menos una talla.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Talla</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>{hasExisting ? "Ajustar" : ""}</TableHead>
                <TableHead><span className="sr-only">Quitar</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => {
                const low = r.stock <= threshold;
                return (
                  <TableRow key={r.size}>
                    <TableCell className="font-medium">{r.size}</TableCell>
                    {r.variantId === undefined ? (
                      <>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100000}
                            step={1}
                            required
                            form={formId}
                            value={Number.isNaN(r.stock) ? "" : r.stock}
                            onChange={(e) => setStock(r.size, e.target.value === "" ? NaN : Math.trunc(Number(e.target.value)))}
                            className="w-24"
                            aria-label={`Stock inicial talla ${r.size}`}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-neutral-500">Nueva</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className={low ? "font-semibold text-red-600" : ""}>
                          {r.stock}
                          {low && <span className="ml-1 text-xs font-normal">(bajo)</span>}
                        </TableCell>
                        <TableCell><StockAdjust variantId={r.variantId} /></TableCell>
                      </>
                    )}
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(r.size)}
                        aria-label={`Quitar talla ${r.size}`}>
                        Quitar talla
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {hasExisting && (
        <p className="text-xs text-neutral-500">El stock de tallas ya guardadas se ajusta aquí con +/−; queda registrado.</p>
      )}
      <p className="text-xs text-neutral-500">Las tallas nuevas o quitadas se aplican al pulsar Guardar.</p>
    </div>
  );
}
