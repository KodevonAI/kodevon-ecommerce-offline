import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { CartProvider } from "@/components/store/CartProvider";
import { FavoritesProvider } from "@/components/store/FavoritesProvider";
import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { WhatsAppFab } from "@/components/store/WhatsAppFab";
import { storeSettings } from "@/server/cached";

// Render por petición: los datos ya se cachean con unstable_cache (tag "catalog") y así el build no toca la BD.
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const s = await storeSettings();
  return (
    <CartProvider>
      <FavoritesProvider>
      <div className="flex min-h-dvh flex-col bg-paper text-ink">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:border focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:text-ink">
          Saltar al contenido
        </a>
        <AnnouncementBar />
        <Header />
        <main id="contenido" className="flex-1 scroll-mt-16">{children}</main>
        <Footer storeName={s.storeName || "OFFLINE"} whatsappNumber={s.whatsappNumber} />
        <WhatsAppFab whatsappNumber={s.whatsappNumber} />
      </div>
      </FavoritesProvider>
    </CartProvider>
  );
}
