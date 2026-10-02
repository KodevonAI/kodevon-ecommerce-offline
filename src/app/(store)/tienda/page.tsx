import type { Metadata } from "next";
import Link from "next/link";
import { Filters } from "@/components/store/Filters";
import { ProductGrid } from "@/components/store/ProductCard";
import { parseFilters } from "@/lib/filters";
import { cachedFilters, cachedList } from "@/server/cached";

export const metadata: Metadata = { title: "Tienda", description: "Todo el catálogo de OFFLINE: camisetas, buzos y pantalones." };

type Params = Parameters<typeof parseFilters>[0];

export default async function TiendaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const options = await cachedFilters();
  const f = parseFilters(sp, options);
  const products = await cachedList({ ...f, sort: f.sort ?? "new" });
  const category = options.categories.find((c) => c.slug === f.category);

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-8">
      <div className="flex items-end justify-between gap-4 pb-6 pt-10 md:pt-14">
        <h1 className="font-wide text-3xl md:text-5xl">{category?.name ?? (f.sale ? "Ofertas" : "Tienda")}</h1>
        <p className="pb-1 text-sm text-mute tabular-nums">
          {products.length} {products.length === 1 ? "producto" : "productos"}
        </p>
      </div>

      <Filters options={options} active={f} />

      <div className="pt-8">
        {products.length > 0 ? (
          <ProductGrid products={products} priorityCount={4} />
        ) : (
          <div className="flex flex-col items-start gap-4 py-20">
            <p className="font-wide text-xl font-semibold">No hay productos con esos filtros</p>
            <p className="text-ink/70">Prueba con otra talla o color, o quita algún filtro.</p>
            <Link href="/tienda" className="inline-flex h-11 items-center press rounded-full px-6 text-sm font-medium">
              Limpiar filtros
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
