import { TRUST_POINTS } from "@/lib/store-info";

export function TrustStrip() {
  return (
    <section aria-label="Cómo compras en OFFLINE" className="mx-auto max-w-[1440px] px-4 pt-16 md:px-8 md:pt-28">
      <ul className="t-rule-y grid grid-cols-2 gap-x-6 gap-y-6 py-8 md:grid-cols-4 md:py-10">
        {TRUST_POINTS.map((p) => (
          <li key={p.title}>
            <p className="text-sm font-semibold">{p.title}</p>
            <p className="mt-1 text-sm leading-snug text-mute">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
