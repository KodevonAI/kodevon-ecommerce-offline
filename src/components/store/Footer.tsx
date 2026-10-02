import Link from "next/link";
import { buildCustomerChatUrl } from "@/lib/whatsapp";

const link = "transition-colors hover:text-[color:var(--footer-hover)]";

export function Footer({ storeName, whatsappNumber }: { storeName: string; whatsappNumber: string }) {
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
          <Link href="/favoritos" className={link}>Favoritos</Link>
        </nav>
        <nav aria-label="Legal" className="flex flex-col gap-2 text-sm text-[color:var(--footer-mute)]">
          <Link href="/privacidad" className={link}>Privacidad</Link>
          <Link href="/terminos" className={link}>Términos de compra</Link>
        </nav>
      </div>
      <div className="border-t border-[color:var(--footer-line)]">
        <p className="mx-auto max-w-[1440px] px-4 py-4 text-xs text-[color:var(--footer-mute)] md:px-8">
          © {year} {storeName}. Precios en pesos colombianos.
        </p>
      </div>
    </footer>
  );
}
