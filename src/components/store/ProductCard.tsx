import Link from "next/link";
import type { ProductCard as Card } from "@/server/catalog";
import { Price, discountPct } from "./Price";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product, priority }: { product: Card; priority?: boolean }) {
  const pct = discountPct(product.price, product.salePrice);
  return (
    <Link href={`/producto/${product.slug}`} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
      <div className="relative">
        <ProductImage
          src={product.image}
          name={product.name}
          priority={priority}
          sizes="(min-width: 1024px) 25vw, 50vw"
          className={product.inStock ? "" : "opacity-60 grayscale"}
        />
        {!product.inStock ? (
          <span className="absolute left-0 top-0 bg-ink px-2 py-1 text-xs font-medium text-paper">Agotado</span>
        ) : pct > 0 ? (
          <span className="absolute left-0 top-0 bg-paper px-2 py-1 text-xs font-medium tabular-nums text-ink">−{pct}%</span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-0.5 pr-2 text-sm">
        <h3 className="font-medium leading-snug underline-offset-4 group-hover:underline">{product.name}</h3>
        <Price price={product.price} salePrice={product.salePrice} className="text-ink/80" />
      </div>
    </Link>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Card[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-5 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
