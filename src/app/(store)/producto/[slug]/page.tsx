import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/store/Gallery";
import { Price, discountPct } from "@/components/store/Price";
import { VariantPicker } from "@/components/store/VariantPicker";
import { cachedProduct } from "@/server/cached";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await cachedProduct((await params).slug);
  if (!p) return { title: "Producto no encontrado" };
  const description = (p.description || `${p.name} de OFFLINE`).slice(0, 160);
  return {
    title: p.name,
    description,
    openGraph: { title: p.name, description, images: p.images[0] ? [p.images[0]] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const p = await cachedProduct((await params).slug);
  if (!p) notFound();
  const pct = discountPct(p.price, p.salePrice);
  const soldOut = p.variants.every((v) => v.stock <= 0);

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-8 pt-4 md:px-8 md:pt-8">
      <nav aria-label="Ruta" className="mb-4 text-sm text-mute">
        <Link href="/tienda" className="underline-offset-4 hover:text-ink hover:underline">Tienda</Link>
        {p.categoryName && <span> / {p.categoryName}</span>}
      </nav>
      <div className="grid gap-8 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-12 lg:gap-20">
        <Gallery images={p.images} name={p.name} />
        <div className="md:sticky md:top-24 md:self-start">
          <h1 className="font-wide text-3xl font-semibold leading-[1.05] md:text-4xl">{p.name}</h1>
          <div className="mt-4 flex items-center gap-3 text-lg">
            <Price price={p.price} salePrice={p.salePrice} />
            {pct > 0 && !soldOut && <span className="bg-ink px-2 py-0.5 text-xs font-medium tabular-nums text-paper">−{pct}%</span>}
          </div>
          <div className="mt-8">
            <VariantPicker variants={p.variants} />
          </div>
          {p.description && (
            <div className="mt-8 border-t border-line pt-6">
              <h2 className="mb-2 text-sm font-medium">Descripción</h2>
              <p className="max-w-prose whitespace-pre-line leading-relaxed text-ink/80">{p.description}</p>
            </div>
          )}
          <p className="mt-6 border-t border-line pt-6 text-sm text-ink/70">
            El envío se acuerda por WhatsApp cuando confirmamos tu pedido.
          </p>
        </div>
      </div>
    </div>
  );
}
