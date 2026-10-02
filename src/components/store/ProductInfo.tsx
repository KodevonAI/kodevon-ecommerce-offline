import { STORE_INFO } from "@/lib/store-info";

const ITEMS = [
  { title: "Envío", body: STORE_INFO.shipping },
  { title: "Cambios y devoluciones", body: STORE_INFO.returns },
  { title: "Pago", body: STORE_INFO.payment },
] as const;

export function ProductInfo() {
  return (
    <div className="t-rule-t mt-8">
      {ITEMS.map((i) => (
        <details key={i.title} className="group t-rule-b">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            {i.title}
            <span aria-hidden className="text-lg leading-none text-mute transition-transform duration-200 group-open:rotate-45">+</span>
          </summary>
          <p className="max-w-prose pb-4 text-sm leading-relaxed text-mute">{i.body}</p>
        </details>
      ))}
    </div>
  );
}
