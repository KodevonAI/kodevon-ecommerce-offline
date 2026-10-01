import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { formatCop } from "@/lib/money";
import { buildOrderMessage, buildWaUrl } from "@/lib/whatsapp";
import { isDemoMode } from "@/server/cached";
import { getPublicOrder, STATUS_LABEL, type PublicOrder } from "@/server/orders-public";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false } };

type Props = { params: Promise<{ code: string }> };

async function load(code: string): Promise<{ order: PublicOrder; whatsappNumber: string } | null> {
  if (isDemoMode()) {
    const demo = await import("@/server/demo-data");
    return code === "OFF-DEMO" ? { order: demo.demoOrder(), whatsappNumber: demo.DEMO_SETTINGS.whatsappNumber } : null;
  }
  const db = getDb();
  const order = await getPublicOrder(db, code);
  if (!order) return null;
  return { order, whatsappNumber: (await getSettings(db)).whatsappNumber };
}

export default async function OrderPage({ params }: Props) {
  const found = await load((await params).code);
  if (!found) notFound();
  const { order, whatsappNumber } = found;
  const waUrl = buildWaUrl(whatsappNumber, buildOrderMessage({ code: order.code, name: order.customerName, lines: order.lines, total: order.total }));

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16 pt-6 md:px-8 md:pt-10">
      <p className="text-sm text-mute">Pedido</p>
      <h1 className="font-wide text-3xl font-semibold leading-[1.05] md:text-4xl">{order.code}</h1>
      <p className="mt-4 inline-block border border-ink px-3 py-1 text-sm font-medium">{STATUS_LABEL[order.status]}</p>

      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-mute">Nombre</dt><dd>{order.customerName}</dd>
        <dt className="text-mute">Celular</dt><dd className="tabular-nums">{order.maskedPhone}</dd>
      </dl>

      <ul className="mt-8 border-t border-line">
        {order.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-4 border-b border-line py-3 text-sm">
            <span>{l.productName} <span className="text-mute">{l.colorName} / {l.size} x{l.qty}</span></span>
            <span className="tabular-nums">{formatCop(l.unitPrice * l.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between">
        <span>Total productos</span>
        <span className="text-xl font-semibold tabular-nums">{formatCop(order.total)}</span>
      </div>
      <p className="mt-2 text-sm text-ink/70">El envío se acuerda por WhatsApp.</p>

      {order.status === "pending" && (
        <p className="mt-8 text-sm">Tu pedido está pendiente: lo confirmamos por WhatsApp. Si no se abrió la conversación, ábrela de nuevo.</p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-6">
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center rounded-full bg-ink px-8 font-medium text-paper hover:opacity-85">
          Abrir WhatsApp de nuevo
        </a>
        <Link href="/tienda" className="text-sm underline underline-offset-4">Seguir comprando</Link>
      </div>
    </div>
  );
}
