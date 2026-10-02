import Link from "next/link";
import type { Theme } from "@/lib/theme";
import { buildCustomerChatUrl } from "@/lib/whatsapp";
import { ThemeSwitch } from "./ThemeSwitch";

const link = "transition-colors hover:text-[color:var(--footer-hover)]";

export function Footer({ storeName, whatsappNumber, theme }: { storeName: string; whatsappNumber: string; theme: Theme }) {
  const year = new Date().getFullYear();
  return (
    <footer className="t-footer mt-24">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 md:grid-cols-[2fr_1fr_1fr_1fr] md:px-8">
        <div className="max-w-sm">
          <p className="text-base leading-relaxed text-[color:var(--footer-mute)]">
            Pides por la web, confirmamos por WhatsApp y acordamos el envío contigo. Sin cuentas ni contraseñas.
          </p>
          {whatsappNumber && (
            <a
              href={buildCustomerChatUrl(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="press mt-5 inline-flex h-11 items-center rounded-full px-5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--footer-fg)]"
            >
              Escríbenos por WhatsApp
            </a>
          )}
        </div>
        <nav aria-label="Tienda" className="flex flex-col gap-2 text-sm text-[color:var(--footer-mute)]">
          <Link href="/tienda" className={link}>Todo</Link>
          <Link href="/tienda?sort=new" className={link}>Novedades</Link>
          <Link href="/tienda?sale=1" className={link}>Ofertas</Link>
        </nav>
        <nav aria-label="Pedido" className="flex flex-col gap-2 text-sm text-[color:var(--footer-mute)]">
          <Link href="/carrito" className={link}>Carrito</Link>
        </nav>
        <nav aria-label="Legal" className="flex flex-col gap-2 text-sm text-[color:var(--footer-mute)]">
          <Link href="/privacidad" className={link}>Privacidad</Link>
          <Link href="/terminos" className={link}>Términos de compra</Link>
        </nav>
      </div>
      <p aria-hidden className="pop-only wordmark overflow-hidden whitespace-nowrap px-4 text-[17.5vw] text-pop-yellow md:px-8 min-[1440px]:text-[252px]">OFFLINE</p>
      <div className="border-t border-[color:var(--footer-line)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-4 text-xs text-[color:var(--footer-mute)] md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {year} {storeName}. Precios en pesos colombianos.</p>
          <ThemeSwitch theme={theme} />
        </div>
      </div>
    </footer>
  );
}
