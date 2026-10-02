"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useCart } from "@/components/store/CartProvider";
import { useCartLines } from "@/components/store/useCartLines";
import { formatCop } from "@/lib/money";
import { checkoutSchema } from "@/lib/validators";
import type { ItemIssue } from "@/server/types";
import { placeOrder } from "./actions";

const REASON: Record<ItemIssue["reason"], string> = {
  not_found: "ya no existe",
  inactive: "ya no está disponible",
  insufficient: "no tiene suficientes unidades",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { clear, items } = useCart();
  const { lines, loading, failed, notices, dismissNotices, refresh, total } = useCartLines();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueMsgs, setIssueMsgs] = useState<string[]>([]);
  const inFlight = useRef(false);

  const nameErr = checkoutSchema.shape.name.safeParse(name);
  const phoneErr = checkoutSchema.shape.phone.safeParse(phone);
  const nameMsg = touched.name && !nameErr.success ? nameErr.error.issues[0].message : null;
  const phoneMsg = touched.phone && !phoneErr.success ? phoneErr.error.issues[0].message : null;
  const empty = !loading && lines.length === 0 && !done;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setTouched({ name: true, phone: true });
    setError(null);
    setIssueMsgs([]);
    if (!nameErr.success || !phoneErr.success || lines.length === 0) return;
    inFlight.current = true;
    setPending(true);
    try {
      const r = await placeOrder({ name, phone, items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })) });
      if (!r.ok) {
        setError(r.error);
        if (r.issues?.length) {
          const byId = new Map(lines.map((l) => [l.variantId, l]));
          setIssueMsgs(r.issues.map((i) => {
            const l = byId.get(i.variantId);
            const label = l ? `${l.productName} (${l.colorName} / ${l.size})` : "Un producto";
            return i.reason === "insufficient" ? `${label}: solo quedan ${i.available}.` : `${label} ${REASON[i.reason]}.`;
          }));
          refresh(); // recarga el stock y reconcilia el carrito
        }
        return;
      }
      setDone(true);
      clear();
      const w = window.open(r.waUrl, "_blank");
      if (w === null) {
        router.replace(`/pedido/${r.code}`); // al volver de WhatsApp con Atrás, cae en el pedido
        window.location.href = r.waUrl; // popup bloqueado: abrir WhatsApp en esta pestaña
        return;
      }
      router.push(`/pedido/${r.code}`);
    } catch {
      setError("No pudimos crear el pedido. Intenta de nuevo.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const field = "t-field h-12 w-full px-3 text-base aria-[invalid=true]:border-pop-red";

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 md:px-8 md:pt-10">
      <h1 className="font-wide text-3xl font-semibold leading-[1.05] md:text-4xl">Tus datos</h1>

      {notices.length > 0 && (
        <div role="status" className="mt-6 border border-ink p-4 text-sm">
          <ul className="flex flex-col gap-1">{notices.map((n, i) => <li key={i}>{n}</li>)}</ul>
          <button type="button" onClick={dismissNotices} className="mt-3 underline underline-offset-4">Entendido</button>
        </div>
      )}
      {failed && <p role="alert" className="mt-6 text-sm">No pudimos cargar tu carrito. Recarga la página.</p>}
      {loading && !failed && <p className="mt-8 text-mute" aria-live="polite">Cargando…</p>}

      {done && <p className="mt-8" role="status">Pedido creado. Te llevamos a la confirmación…</p>}

      {empty && !failed && (
        <div className="mt-10 border-t border-line pt-10">
          <p className="text-lg">Tu carrito está vacío.</p>
          <Link href="/tienda" className="mt-6 inline-flex h-12 items-center press rounded-full px-8 font-medium">Ir a la tienda</Link>
        </div>
      )}

      {lines.length > 0 && !done && (
        <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_360px] md:gap-14">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium">Nombre</label>
              <input id="name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))} aria-invalid={Boolean(nameMsg)} aria-describedby={nameMsg ? "name-err" : undefined} className={field} />
              {nameMsg && <p id="name-err" className="mt-2 text-sm">{nameMsg}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-medium">Celular</label>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="300 123 4567…" value={phone} onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))} aria-invalid={Boolean(phoneMsg)} aria-describedby={phoneMsg ? "phone-err" : undefined} className={field} />
              {phoneMsg && <p id="phone-err" className="mt-2 text-sm">{phoneMsg}</p>}
            </div>

            {(error || issueMsgs.length > 0) && (
              <div role="alert" className="t-notice p-4 text-sm">
                {error && <p className="font-medium">{error}</p>}
                {issueMsgs.length > 0 && <ul className="mt-2 flex flex-col gap-1">{issueMsgs.map((m, i) => <li key={i}>{m}</li>)}</ul>}
                {issueMsgs.length > 0 && <Link href="/carrito" className="mt-3 inline-block underline underline-offset-4">Revisar carrito</Link>}
              </div>
            )}

            <button type="submit" disabled={pending}
              className="h-13 press rounded-full text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-shade disabled:text-ink/70 disabled:ring-1 disabled:ring-inset disabled:ring-line">
              {pending ? "Enviando pedido…" : "Pedir por WhatsApp"}
            </button>
            <p className="text-sm text-ink/70">Te abrimos WhatsApp con tu pedido listo. Confirmamos disponibilidad y acordamos el envío por ahí.</p>
          </form>

          <aside className="t-panel p-5 md:self-start">
            <h2 className="mb-3 text-sm font-medium">Resumen</h2>
            <ul className="border-t border-line">
              {lines.map((l) => (
                <li key={l.variantId} className="flex justify-between gap-4 border-b border-line py-3 text-sm">
                  <span className="min-w-0">
                    {l.productName} <span className="text-mute">{l.colorName} / {l.size} x{l.qty}</span>
                  </span>
                  <span className="tabular-nums">{formatCop(l.price * l.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between">
              <span>Total productos</span>
              <span className="text-xl font-semibold tabular-nums">{formatCop(total)}</span>
            </div>
            <p className="mt-2 text-sm text-ink/70">El envío se acuerda por WhatsApp.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
