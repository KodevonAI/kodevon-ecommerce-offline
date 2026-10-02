import Link from "next/link";
import type { ProductCard as Card } from "@/server/catalog";
import { FavoriteButton } from "./FavoriteButton";
import { Price, discountPct } from "./Price";
import { ProductImage } from "./ProductImage";

const MAX_DOTS = 5;

export function ProductCard({ product, priority }: { product: Card; priority?: boolean }) {
  const pct = discountPct(product.price, product.salePrice);
  const hasColor = product.colorName !== "";
  const dots = [...(hasColor ? [{ colorName: product.colorName, colorHex: product.colorHex }] : []), ...(product.colors ?? [])];
  const shown = dots.slice(0, MAX_DOTS);
  const extra = dots.length - shown.length;
  return (
    <div className="group relative">
    <Link href={`/producto/${product.slug}`} className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
      <div className="relative">
        <div className="t-lift">
          <ProductImage
            src={product.image}
            name={product.name}
            priority={priority}
            sizes="(min-width: 1024px) 25vw, 50vw"
            className={product.inStock ? "" : "opacity-60 grayscale"}
          />
        </div>
        {!product.inStock ? (
          <span className="t-soldout">Agotado</span>
        ) : pct > 0 ? (
          <span className="t-sale">−{pct}%</span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-0.5 pr-2 text-sm">
        <h3 className="font-medium leading-snug underline-offset-4 group-hover:underline">{product.name}</h3>
        <Price price={product.price} salePrice={product.salePrice} className="font-medium" />
        <div className="mt-1 flex items-center gap-1.5 text-xs text-mute">
          <span aria-hidden className="flex items-center gap-1">
            {shown.map((d, i) => (
              <span key={`${d.colorName}-${i}`} title={d.colorName} className="block size-3 rounded-full t-dot" style={{ backgroundColor: d.colorHex }} />
            ))}
            {extra > 0 && <span className="ml-0.5 tabular-nums">+{extra}</span>}
          </span>
          {hasColor && <span>{product.colorName}</span>}
        </div>
      </div>
    </Link>
    <FavoriteButton slug={product.slug} name={product.name} className="absolute right-3 top-3 z-10" />
    </div>
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
