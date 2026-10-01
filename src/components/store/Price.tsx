import { formatCop } from "@/lib/money";

export function Price({ price, salePrice, className = "" }: { price: number; salePrice: number | null; className?: string }) {
  if (salePrice === null || salePrice >= price) {
    return <span className={`tabular-nums ${className}`}>{formatCop(price)}</span>;
  }
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 tabular-nums ${className}`}>
      <span>{formatCop(salePrice)}</span>
      <s className="text-mute decoration-1">
        <span className="sr-only">Antes </span>
        {formatCop(price)}
      </s>
    </span>
  );
}

export const discountPct = (price: number, salePrice: number | null) =>
  salePrice !== null && salePrice < price ? Math.round((1 - salePrice / price) * 100) : 0;
