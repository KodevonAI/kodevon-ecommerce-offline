"use client";

import { useRef } from "react";
import { buildWaUrl } from "@/lib/whatsapp";

const STEPS = [
  { part: "Pecho", how: "Mide alrededor de la parte más ancha, con los brazos relajados y la cinta horizontal." },
  { part: "Cintura", how: "Mide alrededor de la parte más estrecha del torso, sin apretar la cinta." },
  { part: "Cadera", how: "Mide alrededor de la parte más ancha, con los pies juntos." },
  { part: "Largo", how: "Compara con una prenda que ya te quede bien: mídela extendida, del hombro al borde." },
];

export function SizeGuide({ productName, colorName, whatsappNumber }: { productName: string; colorName: string; whatsappNumber: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="underline underline-offset-4 hover:text-[color:var(--accent-link)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        Guía de tallas
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="guia-tallas-titulo"
        onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}
        className="t-panel m-auto max-h-[90dvh] w-[min(92vw,520px)] overflow-y-auto bg-paper p-6 text-ink shadow-[0_24px_80px_rgb(0_0_0/0.35)] backdrop:bg-black/50 backdrop:backdrop-blur-sm [overscroll-behavior:contain] md:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="guia-tallas-titulo" className="font-wide text-2xl">Guía de tallas</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Cerrar guía de tallas"
            className="t-icon-btn -mr-2 -mt-1 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-mute">Para elegir bien, tómate estas medidas con una cinta métrica y compáralas con las de la prenda.</p>
        <dl className="mt-5 flex flex-col gap-4">
          {STEPS.map((s) => (
            <div key={s.part}>
              <dt className="text-sm font-semibold">{s.part}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-mute">{s.how}</dd>
            </div>
          ))}
        </dl>
        <p className="t-rule-t mt-6 pt-5 text-sm leading-relaxed">
          Las medidas exactas de cada prenda las confirmamos contigo. Dinos tu talla habitual y te decimos cuál te queda mejor.
        </p>
        {whatsappNumber && (
          <a
            href={buildWaUrl(whatsappNumber, `Hola OFFLINE, tengo una duda de talla sobre ${productName}${colorName ? ` (${colorName})` : ""}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="press mt-5 inline-flex h-11 items-center rounded-full px-6 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            Preguntar por WhatsApp
          </a>
        )}
      </dialog>
    </>
  );
}
