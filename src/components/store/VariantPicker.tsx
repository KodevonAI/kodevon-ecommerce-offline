"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MAX_QTY_PER_LINE } from "@/lib/validators";
import { sortSizes } from "@/lib/sizes";
import { useCart } from "./CartProvider";

export type PickerVariant = { id: number; size: string; stock: number };
export type PickerSibling = { slug: string; colorName: string; colorHex: string; inStock: boolean };

const LOW_STOCK = 3;

export function VariantPicker({
  variants, colorName, siblings = [], currentSlug, initialSize,
}: {
  variants: PickerVariant[];
  colorName: string;
  siblings: PickerSibling[];
  currentSlug: string;
  initialSize?: string;
}) {
  const { items, add } = useCart();
  const router = useRouter();

  const soldOut = variants.every((v) => v.stock <= 0);
  const [size, setSize] = useState<string | null>(() =>
    initialSize && variants.some((v) => v.size === initialSize && v.stock > 0) ? initialSize : null,
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<number | null>(null);

  const sizeVariants = useMemo(
    () => sortSizes(variants.map((v) => v.size)).map((s) => variants.find((v) => v.size === s)!),
    [variants],
  );

  const variant = sizeVariants.find((v) => v.size === size && v.stock > 0) ?? null;
  const inCart = variant ? items.find((i) => i.variantId === variant.id)?.qty ?? 0 : 0;
  const cap = variant ? Math.min(variant.stock, MAX_QTY_PER_LINE) : 0;
  const room = Math.max(0, cap - inCart);
  const q = Math.min(qty, Math.max(room, 1));

  function goToColor(slug: string) {
    if (slug === currentSlug) return;
    router.push(`/producto/${slug}${size ? `?talla=${encodeURIComponent(size)}` : ""}`, { scroll: false });
  }

  function onAdd() {
    if (!variant || room <= 0) return;
    add({ variantId: variant.id, qty: q }, variant.stock);
    setAdded(q);
    setQty(1);
  }

  return (
    <div className="flex flex-col gap-7">
      {siblings.length > 1 ? (
        <fieldset>
          <legend className="mb-3 flex w-full justify-between text-sm">
            <span className="font-medium">Color</span>
            <span className="text-mute">{colorName}</span>
          </legend>
          <div className="flex flex-wrap gap-3">
            {siblings.map((c) => {
              const current = c.slug === currentSlug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => goToColor(c.slug)}
                  aria-current={current ? "true" : undefined}
                  aria-label={!c.inStock ? `${c.colorName} (agotado)` : c.colorName}
                  title={c.colorName}
                  className={`relative size-10 rounded-full p-[3px] ring-1 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${current ? "ring-2 ring-ink" : "ring-line hover:ring-mute"}`}
                >
                  <span className="block size-full rounded-full border border-black/10" style={{ backgroundColor: c.colorHex }} />
                  {!c.inStock && <span aria-hidden className="absolute left-1/2 top-1/2 h-px w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-ink/70" />}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="flex justify-between text-sm">
          <span className="font-medium">Color</span>
          <span className="text-mute">{colorName}</span>
        </p>
      )}

      {soldOut ? (
        <div className="flex flex-col gap-3">
          <button type="button" disabled className="h-13 w-full cursor-not-allowed rounded-full bg-line text-base font-medium text-mute">
            Agotado
          </button>
          <p className="text-sm text-mute">Esta prenda no tiene unidades por ahora.</p>
          {siblings.some((x) => x.slug !== currentSlug && x.inStock) && <p className="text-sm">Disponible en otro color</p>}
        </div>
      ) : (
        <>
      <fieldset>
        <legend className="mb-3 flex w-full justify-between text-sm">
          <span className="font-medium">Talla</span>
        </legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {sizeVariants.map((v) => {
            const out = v.stock <= 0;
            const selected = size === v.size && !out;
            return (
              <button
                key={v.size}
                type="button"
                disabled={out}
                aria-pressed={selected}
                aria-label={out ? `${v.size} (agotada)` : v.size}
                onClick={() => { setSize(v.size); setAdded(null); setQty(1); }}
                className={`h-11 border text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed ${
                  selected ? "border-ink bg-ink text-paper"
                  : out ? "border-line text-mute/70 line-through"
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
          {!variant ? "Elige una talla" : room <= 0 ? "Ya tienes todas las unidades" : "Agregar al carrito"}
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
        </>
      )}
    </div>
  );
}
