"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MAX_QTY_PER_LINE } from "@/lib/validators";
import { sortSizes } from "@/lib/sizes";
import { useCart } from "./CartProvider";

export type PickerVariant = { id: number; size: string; colorName: string; colorHex: string; stock: number };

const LOW_STOCK = 3;

export function VariantPicker({ variants }: { variants: PickerVariant[] }) {
  const { items, add } = useCart();

  const colors = useMemo(() => {
    const m = new Map<string, { name: string; hex: string; stock: number }>();
    for (const v of variants) {
      const c = m.get(v.colorName);
      if (c) c.stock += v.stock;
      else m.set(v.colorName, { name: v.colorName, hex: v.colorHex, stock: v.stock });
    }
    return [...m.values()];
  }, [variants]);

  const soldOut = variants.every((v) => v.stock <= 0);
  const [color, setColor] = useState<string | null>(() => {
    const available = colors.filter((c) => c.stock > 0);
    return available.length === 1 ? available[0].name : colors.length === 1 ? colors[0].name : null;
  });
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<number | null>(null);

  const sizesForColor = useMemo(() => {
    if (!color) return [];
    const vs = variants.filter((v) => v.colorName === color);
    return sortSizes(vs.map((v) => v.size)).map((s) => vs.find((v) => v.size === s)!);
  }, [variants, color]);

  const variant = sizesForColor.find((v) => v.size === size && v.stock > 0) ?? null;
  const inCart = variant ? items.find((i) => i.variantId === variant.id)?.qty ?? 0 : 0;
  const cap = variant ? Math.min(variant.stock, MAX_QTY_PER_LINE) : 0;
  const room = Math.max(0, cap - inCart);
  const q = Math.min(qty, Math.max(room, 1));

  function chooseColor(name: string) {
    setColor(name);
    setAdded(null);
    // Conserva la talla si existe y hay stock en el nuevo color.
    const keep = variants.some((v) => v.colorName === name && v.size === size && v.stock > 0);
    if (!keep) setSize(null);
    setQty(1);
  }

  function onAdd() {
    if (!variant || room <= 0) return;
    add({ variantId: variant.id, qty: q }, variant.stock);
    setAdded(q);
    setQty(1);
  }

  if (soldOut) {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" disabled className="h-13 w-full cursor-not-allowed rounded-full bg-line text-base font-medium text-mute">
          Agotado
        </button>
        <p className="text-sm text-mute">Esta prenda no tiene unidades por ahora.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <fieldset>
        <legend className="mb-3 flex w-full justify-between text-sm">
          <span className="font-medium">Color</span>
          <span className="text-mute">{color ?? "Elige un color"}</span>
        </legend>
        <div className="flex flex-wrap gap-3">
          {colors.map((c) => {
            const selected = color === c.name;
            const out = c.stock <= 0;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => chooseColor(c.name)}
                aria-pressed={selected}
                aria-label={out ? `${c.name} (agotado)` : c.name}
                title={c.name}
                className={`relative size-10 rounded-full p-[3px] ring-1 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${selected ? "ring-2 ring-ink" : "ring-line hover:ring-mute"}`}
              >
                <span className="block size-full rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                {out && <span aria-hidden className="absolute left-1/2 top-1/2 h-px w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-ink/70" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset disabled={!color}>
        <legend className="mb-3 flex w-full justify-between text-sm">
          <span className="font-medium">Talla</span>
          {!color && <span className="text-mute">Primero elige un color</span>}
        </legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {(color ? sizesForColor : sortSizes([...new Set(variants.map((v) => v.size))]).map((s) => ({ id: -1, size: s, stock: 0 }))).map((v) => {
            const out = color !== null && v.stock <= 0;
            const selected = size === v.size && !out;
            return (
              <button
                key={v.size}
                type="button"
                disabled={!color || out}
                aria-pressed={selected}
                aria-label={out ? `${v.size} (agotada)` : v.size}
                onClick={() => { setSize(v.size); setAdded(null); setQty(1); }}
                className={`h-11 border text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed ${
                  selected ? "border-ink bg-ink text-paper"
                  : out ? "border-line text-mute/70 line-through"
                  : !color ? "border-line text-mute"
                  : "border-line hover:border-ink"
                }`}
              >
                {v.size}
              </button>
            );
          })}
        </div>
        <p className="mt-3 min-h-5 text-sm" aria-live="polite">
          {variant && variant.stock <= LOW_STOCK && <span className="font-medium">Quedan {variant.stock}</span>}
        </p>
      </fieldset>

      <div className="flex items-stretch gap-3">
        <div className="flex h-13 items-center border border-line" role="group" aria-label="Cantidad">
          <button type="button" className="h-full w-11 text-lg disabled:text-line" onClick={() => setQty(Math.max(1, q - 1))} disabled={!variant || q <= 1} aria-label="Restar uno">−</button>
          <output className="w-8 text-center text-sm tabular-nums" aria-live="polite">{q}</output>
          <button type="button" className="h-full w-11 text-lg disabled:text-line" onClick={() => setQty(Math.min(room, q + 1))} disabled={!variant || q >= room} aria-label="Sumar uno">+</button>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!variant || room <= 0}
          className="h-13 flex-1 rounded-full bg-ink text-base font-medium text-paper transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-line disabled:text-mute"
        >
          {!color ? "Elige color y talla" : !variant ? "Elige una talla" : room <= 0 ? "Ya tienes todas las unidades" : "Agregar al carrito"}
        </button>
      </div>

      <div aria-live="polite" className="min-h-6 text-sm">
        {added !== null && (
          <p className="flex flex-wrap items-center gap-x-3">
            <span>{added === 1 ? "Agregado al carrito." : `${added} unidades agregadas al carrito.`}</span>
            <Link href="/carrito" className="font-medium underline underline-offset-4">Ver carrito</Link>
          </p>
        )}
      </div>
    </div>
  );
}
