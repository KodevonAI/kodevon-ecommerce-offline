"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function NavLinks() {
  const pathname = usePathname();
  const onSale = useSearchParams().get("sale") === "1";
  const inShop = pathname === "/tienda" || pathname.startsWith("/producto/");
  const items = [
    { href: "/tienda", label: "Tienda", current: inShop && !onSale },
    { href: "/tienda?sale=1", label: "Ofertas", current: pathname === "/tienda" && onSale },
  ];
  return (
    <>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.current ? "page" : undefined}
          className="t-nav"
        >
          {i.label}
        </Link>
      ))}
    </>
  );
}
