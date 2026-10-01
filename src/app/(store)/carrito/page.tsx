"use client";

import Link from "next/link";
import { ProductImage } from "@/components/store/ProductImage";
import { useCart } from "@/components/store/CartProvider";
import { useCartLines } from "@/components/store/useCartLines";
import { formatCop } from "@/lib/money";

export default function CartPage() {
  const { setQty, remove } = useCart();
  const { lines, loading, failed, notices, dismissNotices, total } = useCartLines();
  const empty = !loading && lines.length === 0;

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 md:px-8 md:pt-10">
      <h1 className="font-wide text-3xl font-semibold leading-[1.05] md:text-4xl">Carrito</h1>

      {notices.length > 0 && (
        <div role="status" className="mt-6 border border-ink p-4 text-sm">
          <ul className="flex flex-col gap-1">
            {notices.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
          <button type="button" onClick={dismissNotices} className="mt-3 underline underline-offset-4">Entendido</button>
        </div>
      )}

      {failed && <p role="alert" className="mt-6 text-sm">No pudimos cargar tu carrito. Revisa tu conexión y recarga la página.</p>}

      {loading && !failed && <p className="mt-8 text-mute" aria-live="polite">Cargando carrito…</p>}

      {empty && !failed && (
        <div className="mt-10 border-t border-line pt-10">
          <p className="text-lg">Tu carrito está vacío.</p>
          <Link href="/tienda" className="mt-6 inline-flex h-12 items-center rounded-full bg-ink px-8 font-medium text-paper hover:opacity-85">
            Ir a la tienda
          </Link>
          <button type="button" disabled className="mt-4 flex h-13 w-full cursor-not-allowed items-center justify-center rounded-full bg-line text-base font-medium text-mute sm:w-64">
            Continuar
          </button>
        </div>
      )}

      {lines.length > 0 && (
        <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:gap-14">
          <ul className="border-t border-line">
            {lines.map((l) => (
              <li key={l.variantId} className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 border-b border-line py-5 sm:grid-cols-[112px_minmax(0,1fr)]">
                <Link href={`/producto/${l.slug}`} aria-label={l.productName}>
                  <ProductImage src={l.image} name={l.productName} sizes="112px" />
                </Link>
                <div className="flex min-w-0 flex-col justify-between gap-3">
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={`/producto/${l.slug}`} className="font-medium underline-offset-4 hover:underline">{l.productName}</Link>
                      <p className="mt-1 text-sm text-mute">{l.colorName} / {l.size}</p>
                      <p className="mt-1 text-sm tabular-nums">{formatCop(l.price)}</p>
                    </div>
                    <p className="font-medium tabular-nums">{formatCop(l.price * l.qty)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-10 items-center border border-line" role="group" aria-label={`Cantidad de ${l.productName}`}>
                      <button type="button" className="h-full w-10 text-lg" aria-label="Restar uno" onClick={() => setQty(l.variantId, l.qty - 1, l.stock)}>−</button>
                      <output className="w-8 text-center text-sm tabular-nums" aria-live="polite">{l.qty}</output>
                      <button type="button" className="h-full w-10 text-lg disabled:text-line" aria-label="Sumar uno" disabled={l.qty >= Math.min(l.stock, 20)} onClick={() => setQty(l.variantId, l.qty + 1, l.stock)}>+</button>
                    </div>
                    <button type="button" onClick={() => remove(l.variantId)} className="py-2 text-sm underline underline-offset-4">Quitar</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="md:sticky md:top-24 md:self-start">
            <div className="flex items-baseline justify-between border-b border-line pb-4">
              <span>Total productos</span>
              <span className="text-xl font-semibold tabular-nums">{formatCop(total)}</span>
            </div>
            <p className="mt-4 text-sm text-ink/70">El envío se acuerda por WhatsApp.</p>
            <Link href="/checkout" className="mt-6 flex h-13 w-full items-center justify-center rounded-full bg-ink text-base font-medium text-paper hover:opacity-85">
              Continuar
            </Link>
            <Link href="/tienda" className="mt-4 block text-center text-sm underline underline-offset-4">Seguir comprando</Link>
          </aside>
        </div>
      )}

    </div>
  );
}
