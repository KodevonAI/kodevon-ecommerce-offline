"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link
      href="/carrito"
      aria-label={count > 0 ? `Carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito vacío"}
      className="relative inline-flex size-10 items-center justify-center focus-visible:outline-2 focus-visible:outline-ink"
    >
      <ShoppingBag className="size-5" strokeWidth={2} aria-hidden />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center t-count rounded-full px-1 text-[11px] font-semibold leading-none tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
