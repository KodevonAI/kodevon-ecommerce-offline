import Link from "next/link";
import { ProductGrid } from "@/components/store/ProductCard";
import { cachedFilters, cachedList } from "@/server/cached";

export default async function HomePage() {
  const [filters, products] = await Promise.all([cachedFilters(), cachedList({ sort: "new" })]);
  const latest = products.slice(0, 8);

  return (
    <>
      <section className="mx-auto max-w-[1440px] overflow-hidden px-4 pb-12 pt-8 md:px-8 md:pb-20 md:pt-12">
        <h1>
          <span aria-hidden className="wordmark wordmark-intro block whitespace-nowrap text-[calc((100vw-32px)/5.53)] md:text-[calc((100vw-64px)/5.53)] min-[1440px]:text-[248px]">
            OFFLINE
          </span>
          <span className="sr-only">OFFLINE, ropa para desconectarse</span>
        </h1>
        <div className="mt-8 grid gap-6 md:mt-12 md:grid-cols-12 md:items-end">
          <p className="font-wide text-2xl font-semibold leading-[1.15] md:col-span-7 md:text-4xl lg:text-[2.75rem]">
            Ropa para los ratos sin pantalla.
          </p>
          <div className="flex flex-col gap-5 md:col-span-4 md:col-start-9">
            <p className="max-w-sm text-base leading-relaxed text-ink/75">
              Camisetas, buzos y pantalones de tandas cortas. Eliges aquí, confirmamos tu pedido por WhatsApp y acordamos el envío.
            </p>
            <Link
              href="/tienda"
              className="inline-flex h-12 w-fit items-center rounded-full bg-ink px-7 text-sm font-medium text-paper transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Ver tienda
            </Link>
          </div>
        </div>
      </section>

      {filters.categories.length > 0 && (
        <nav aria-label="Categorías" className="border-y border-line">
          <ul className="mx-auto grid max-w-[1440px] grid-cols-2 md:grid-flow-col md:auto-cols-fr md:grid-cols-none">
            {filters.categories.map((c) => (
              <li key={c.slug} className="border-line [&:nth-child(n+3)]:border-t [&:nth-child(odd)]:border-r md:border-r md:[&:nth-child(n+3)]:border-t-0 md:last:border-r-0">
                <Link
                  href={`/tienda?category=${encodeURIComponent(c.slug)}`}
                  className="font-wide group flex h-20 items-center justify-between px-4 text-lg font-semibold transition-colors hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink md:h-28 md:px-8 md:text-2xl"
                >
                  {c.name}
                  <span aria-hidden className="text-base font-normal opacity-0 transition-opacity group-hover:opacity-100">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section className="mx-auto max-w-[1440px] px-4 pt-14 md:px-8 md:pt-20" aria-labelledby="novedades">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <h2 id="novedades" className="font-wide text-xl font-semibold md:text-2xl">Novedades</h2>
          <Link href="/tienda" className="text-sm underline underline-offset-4">Ver todo</Link>
        </div>
        {latest.length > 0 ? (
          <ProductGrid products={latest} priorityCount={4} />
        ) : (
          <p className="py-16 text-mute">Pronto subimos la primera tanda.</p>
        )}
      </section>
    </>
  );
}
