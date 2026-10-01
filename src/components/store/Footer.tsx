import Link from "next/link";
import { buildCustomerChatUrl } from "@/lib/whatsapp";

export function Footer({ storeName, whatsappNumber }: { storeName: string; whatsappNumber: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 md:grid-cols-[2fr_1fr_1fr] md:px-8">
        <div className="max-w-sm">
          <p className="text-base leading-relaxed text-paper/80">
            Pides por la web, confirmamos por WhatsApp y acordamos el envío contigo. Sin cuentas ni contraseñas.
          </p>
          {whatsappNumber && (
            <a
              href={buildCustomerChatUrl(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex h-11 items-center rounded-full border border-paper/40 px-5 text-sm font-medium transition-colors hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
            >
              Escríbenos por WhatsApp
            </a>
          )}
        </div>
        <nav aria-label="Tienda" className="flex flex-col gap-2 text-sm text-paper/80">
          <Link href="/tienda" className="hover:text-paper">Todo</Link>
          <Link href="/tienda?sort=new" className="hover:text-paper">Novedades</Link>
          <Link href="/tienda?sale=1" className="hover:text-paper">Ofertas</Link>
        </nav>
        <nav aria-label="Pedido" className="flex flex-col gap-2 text-sm text-paper/80">
          <Link href="/carrito" className="hover:text-paper">Carrito</Link>
        </nav>
      </div>
      <div className="border-t border-paper/15">
        <p className="mx-auto max-w-[1440px] px-4 py-4 text-xs text-paper/60 md:px-8">
          © {year} {storeName}. Precios en pesos colombianos.
        </p>
      </div>
    </footer>
  );
}
