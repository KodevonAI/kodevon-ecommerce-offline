import Link from "next/link";
import { Burst } from "@/components/store/Burst";
import { HowToOrder, Lookbook } from "@/components/store/HomeSections";
import { ProductGrid } from "@/components/store/ProductCard";
import { cachedFilters, cachedList } from "@/server/cached";
import { getTheme } from "@/server/theme";

export default async function HomePage() {
  const [filters, products, theme] = await Promise.all([cachedFilters(), cachedList({ sort: "new" }), getTheme()]);
  const latest = products.slice(0, 8);
  const pop = theme === "pop";

  return (
    <>
      {pop ? <PopHero /> : <AppleHero />}

      {filters.categories.length > 0 &&
        (pop ? (
          <nav aria-label="Categorías" className="t-rule-strong-b">
            <ul className="mx-auto grid max-w-[1440px] grid-cols-2 md:grid-flow-col md:auto-cols-fr md:grid-cols-none">
              {filters.categories.map((c, i) => (
                <li key={c.slug} className="border-ink max-md:[&:last-child:nth-child(odd)]:col-span-2 max-md:[&:last-child:nth-child(odd)]:border-r-0 [&:nth-child(n+3)]:border-t-2 [&:nth-child(odd)]:border-r-2 md:border-r-2 md:[&:nth-child(n+3)]:border-t-0 md:last:border-r-0">
                  <Link
                    href={`/tienda?category=${encodeURIComponent(c.slug)}`}
                    className={`t-cat t-cat--${i % 4} font-wide group flex h-24 items-center justify-between px-4 text-xl transition-[filter,padding] duration-150 hover:pl-6 hover:brightness-110 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink md:h-32 md:px-8 md:text-3xl md:hover:pl-10`}
                  >
                    {c.name}
                    <span aria-hidden className="text-2xl font-normal transition-transform duration-150 group-hover:-translate-y-1 group-hover:translate-x-1">↗</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <nav aria-label="Categorías" className="mx-auto max-w-[1440px] px-4 md:px-8">
            <ul className="grid gap-4 md:grid-flow-col md:auto-cols-fr">
              {filters.categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/tienda?category=${encodeURIComponent(c.slug)}`}
                    className="t-cat group flex h-36 flex-col justify-between p-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink md:h-52 md:p-8"
                  >
                    <span className="font-wide text-2xl md:text-3xl">{c.name}</span>
                    <span className="text-sm text-[color:var(--accent-link)] transition-transform duration-200 group-hover:translate-x-1">Ver colección <span aria-hidden>›</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

      <section className="mx-auto max-w-[1440px] px-4 pt-16 md:px-8 md:pt-28" aria-labelledby="novedades">
        <div className="mb-10 flex items-end justify-between gap-4 md:mb-12">
          <h2 id="novedades" className="font-wide t-tag text-2xl md:text-4xl">Novedades</h2>
          <Link href="/tienda" className="text-sm font-medium text-[color:var(--accent-link)] underline-offset-4 hover:underline">Ver todo <span aria-hidden>›</span></Link>
        </div>
        {latest.length > 0 ? (
          <ProductGrid products={latest} priorityCount={4} />
        ) : (
          <p className="py-16 text-mute">Pronto subimos la primera tanda.</p>
        )}
      </section>

      <Lookbook />
      <HowToOrder />
    </>
  );
}

function AppleHero() {
  return (
    <section className="px-4 pb-6 pt-16 md:px-8 md:pt-28">
      <div className="mx-auto max-w-[1100px] text-center">
        <p className="text-sm font-medium text-[color:var(--accent-link)] md:text-base">Nueva tanda</p>
        <h1 className="font-wide mx-auto mt-3 max-w-[14ch] text-5xl leading-[1.04] md:text-[84px]">
          <span className="sr-only">OFFLINE: </span>Ropa para los ratos sin pantalla.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-mute md:text-xl">
          Camisetas, buzos y pantalones de tandas cortas. Eliges aquí, confirmamos tu pedido por WhatsApp y acordamos el envío.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <Link href="/tienda" className="press inline-flex h-12 items-center rounded-full px-7 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
            Ver tienda
          </Link>
          <Link href="/tienda?sale=1" className="text-base font-medium text-[color:var(--accent-link)] underline-offset-4 hover:underline">
            Ver ofertas <span aria-hidden>›</span>
          </Link>
        </div>
      </div>
      <div aria-hidden className="t-frame @container mx-auto mt-14 flex aspect-[16/8] max-w-[1440px] items-end bg-shade md:mt-20">
        <span className="wordmark block translate-y-[12%] select-none whitespace-nowrap pl-[3cqw] text-[27cqw] leading-[0.8] text-[#e6e6ea]">OFFLINE</span>
      </div>
    </section>
  );
}

function PopHero() {
  return (
    <section className="t-rule-strong-b relative overflow-hidden">
      <div
        aria-hidden
        className="halftone pointer-events-none absolute inset-0 text-pop-red opacity-25 [mask-image:radial-gradient(ellipse_at_85%_10%,black,transparent_65%)]"
      />
      <div className="relative mx-auto max-w-[1440px] px-4 pb-14 pt-10 md:px-8 md:pb-24 md:pt-16">
        <h1 className="@container relative">
          <span
            aria-hidden
            className="wordmark wordmark-intro block whitespace-nowrap text-[22cqw] text-ink [text-shadow:3px_3px_0_var(--pop-red)] md:[text-shadow:7px_7px_0_var(--pop-red)] min-[1440px]:[text-shadow:10px_10px_0_var(--pop-red)]"
          >
            OFFLINE
          </span>
          <span className="sr-only">OFFLINE, ropa para desconectarse</span>
          <Burst className="absolute -right-2 -top-12 hidden size-28 rotate-12 sm:grid md:-right-4 md:-top-24 md:size-40">
            <span className="text-xl md:text-3xl">Nueva<br />tanda</span>
          </Burst>
        </h1>

        <div className="mt-12 grid gap-10 md:mt-16 md:grid-cols-12 md:items-end">
          <div className="relative md:col-span-7">
            <p className="font-wide relative rounded-[28px] border-[3px] border-ink bg-white px-6 py-5 text-2xl leading-[1.15] shadow-[6px_6px_0_0_var(--store-ink)] md:px-8 md:py-6 md:text-4xl">
              Ropa para los ratos sin pantalla.
              <span
                aria-hidden
                className="absolute -bottom-[13px] left-12 size-6 rotate-45 border-b-[3px] border-r-[3px] border-ink bg-white"
              />
            </p>
          </div>
          <div className="flex flex-col gap-5 md:col-span-4 md:col-start-9">
            <p className="max-w-sm text-base leading-relaxed text-ink/85">
              Camisetas, buzos y pantalones de tandas cortas. Eliges aquí, confirmamos tu pedido por WhatsApp y acordamos el envío.
            </p>
            <Link
              href="/tienda"
              className="press inline-flex h-12 w-fit items-center rounded-full px-7 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              Ver tienda
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
