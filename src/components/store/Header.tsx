import Link from "next/link";
import { Suspense } from "react";
import { CartLink } from "./CartLink";
import { NavLinks } from "./NavLinks";

export function Header() {
  return (
    <header className="t-header sticky top-0 z-30">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="wordmark text-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" aria-label="OFFLINE, inicio">
          OFFLINE
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 text-sm md:gap-6">
          <Suspense fallback={null}>
            <NavLinks />
          </Suspense>
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
