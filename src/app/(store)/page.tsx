import Image from "next/image";
import Link from "next/link";
import { HowToOrder, Lookbook } from "@/components/store/HomeSections";
import { ProductGrid } from "@/components/store/ProductCard";
import { TrustStrip } from "@/components/store/TrustStrip";
import { cachedBestsellers, cachedFilters, cachedList } from "@/server/cached";

// Foto decorativa por categoría (slug). Si la categoría no está aquí, la tarjeta queda sin imagen.
const CATEGORY_ART: Record<string, string> = {
  camisetas: "/images/cat-camisetas.webp",
  buzos: "/images/cat-buzos.webp",
  pantalones: "/images/cat-pantalones.webp",
};

export default async function HomePage() {
  const [filters, products, bestsellers] = await Promise.all([
    cachedFilters(),
    cachedList({ sort: "new" }),
    cachedBestsellers(),
  ]);
  const latest = products.slice(0, 8);

  return (
    <>
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
        <div className="t-frame relative mx-auto mt-14 aspect-[3/2] max-w-[1440px] md:mt-20 md:aspect-[16/9]">
          <Image
            src="/images/hero.webp"
            alt="Tres mujeres caminando juntas por una calle con árboles, con camiseta oversize, buzo y suéter, y pantalones anchos"
            fill
            priority
            sizes="(min-width: 1440px) 1440px, 100vw"
            className="object-cover object-[50%_60%]"
          />
        </div>
      </section>

      {filters.categories.length > 0 && (
        <nav aria-label="Categorías" className="mx-auto max-w-[1440px] px-4 md:px-8">
          <ul className="grid gap-4 md:grid-flow-col md:auto-cols-fr">
            {filters.categories.map((c) => {
              const art = Object.hasOwn(CATEGORY_ART, c.slug) ? CATEGORY_ART[c.slug] : undefined;
              return (
              <li key={c.slug}>
                <Link
                  href={`/tienda?category=${encodeURIComponent(c.slug)}`}
                  className="t-cat group relative flex h-36 overflow-hidden flex-col justify-between p-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink md:h-52 md:p-8"
                >
                  {art && (
                    <Image
                      src={art}
                      alt=""
                      width={400}
                      height={400}
                      className="pointer-events-none absolute bottom-3 right-3 top-3 h-[calc(100%-1.5rem)] w-auto rounded-[18px] transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  )}
                  <span className="font-wide relative text-2xl md:text-3xl">{c.name}</span>
                  <span className="relative text-sm text-[color:var(--accent-link)] transition-transform duration-200 group-hover:translate-x-1">Ver colección <span aria-hidden>›</span></span>
                </Link>
              </li>
              );
            })}
          </ul>
        </nav>
      )}

      {bestsellers.length >= 3 && (
        <section className="mx-auto max-w-[1440px] px-4 pt-16 md:px-8 md:pt-28" aria-labelledby="mas-vendidos">
          <div className="mb-10 flex items-end justify-between gap-4 md:mb-12">
            <h2 id="mas-vendidos" className="font-wide text-2xl md:text-4xl">Lo más vendido</h2>
            <Link href="/tienda" className="text-sm font-medium text-[color:var(--accent-link)] underline-offset-4 hover:underline">Ver todo <span aria-hidden>›</span></Link>
          </div>
          <ProductGrid products={bestsellers.slice(0, 4)} />
        </section>
      )}

      <section className="mx-auto max-w-[1440px] px-4 pt-16 md:px-8 md:pt-28" aria-labelledby="novedades">
        <div className="mb-10 flex items-end justify-between gap-4 md:mb-12">
          <h2 id="novedades" className="font-wide text-2xl md:text-4xl">Novedades</h2>
          <Link href="/tienda" className="text-sm font-medium text-[color:var(--accent-link)] underline-offset-4 hover:underline">Ver todo <span aria-hidden>›</span></Link>
        </div>
        {latest.length > 0 ? (
          <ProductGrid products={latest} priorityCount={4} />
        ) : (
          <p className="py-16 text-mute">Pronto subimos la primera tanda.</p>
        )}
      </section>

      <TrustStrip />
      <Lookbook />
      <HowToOrder />
    </>
  );
}
