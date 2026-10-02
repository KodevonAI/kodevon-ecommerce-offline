import Link from "next/link";
import { Suspense } from "react";
import { CartLink } from "./CartLink";
import { FavoritesLink } from "./FavoritesLink";
import { HeaderSearch } from "./HeaderSearch";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="t-header sticky top-0 z-30">
      <div className="relative mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="wordmark text-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" aria-label="OFFLINE, inicio">
          OFFLINE
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-0.5 text-sm md:gap-2">
          <Suspense fallback={null}>
            <NavLinks />
          </Suspense>
          <span aria-hidden className="mx-1 hidden h-4 w-px bg-[color:var(--store-line)] sm:block" />
          <HeaderSearch />
          <FavoritesLink />
          <ThemeToggle />
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
