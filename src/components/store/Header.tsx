import Link from "next/link";
import { CartLink } from "./CartLink";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="wordmark text-xl tracking-[0.02em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" aria-label="OFFLINE, inicio">
          OFFLINE
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-2 text-sm md:gap-6">
          <Link href="/tienda" className="px-2 py-2 underline-offset-4 hover:underline">Tienda</Link>
          <Link href="/tienda?sale=1" className="hidden px-2 py-2 underline-offset-4 hover:underline sm:inline">Ofertas</Link>
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
