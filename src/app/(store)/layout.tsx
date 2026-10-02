import { CartProvider } from "@/components/store/CartProvider";
import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { Marquee } from "@/components/store/Marquee";
import { storeSettings } from "@/server/cached";
import { getTheme } from "@/server/theme";

// Render por petición: los datos ya se cachean con unstable_cache (tag "catalog") y así el build no toca la BD.
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [s, theme] = await Promise.all([storeSettings(), getTheme()]);
  return (
    <CartProvider>
      <div className="flex min-h-dvh flex-col bg-paper text-ink">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:border focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:text-ink">
          Saltar al contenido
        </a>
        <Marquee />
        <Header />
        <main id="contenido" className="flex-1 scroll-mt-16">{children}</main>
        <Footer storeName={s.storeName || "OFFLINE"} whatsappNumber={s.whatsappNumber} theme={theme} />
      </div>
    </CartProvider>
  );
}
