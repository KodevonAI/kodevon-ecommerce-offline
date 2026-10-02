import type { Metadata, Viewport } from "next";
import { Archivo, Bangers, Bowlby_One, Geist } from "next/font/google";
import { siteUrl } from "@/lib/site";
import { getTheme } from "@/server/theme";
import "./globals.css";

const geist = Geist({ variable: "--font-body", subsets: ["latin"] });

// Pop art: Bowlby One para titulares y logotipo, Bangers para stickers y globos de cómic.
const bowlby = Bowlby_One({ variable: "--font-pop", subsets: ["latin"], weight: "400" });
const bangers = Bangers({ variable: "--font-callout", subsets: ["latin"], weight: "400" });

// Archivo con eje de ancho: el logotipo y los titulares usan la versión expandida.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "OFFLINE", template: "%s · OFFLINE" },
  description: "OFFLINE: ropa para desconectarse. Camisetas, buzos y pantalones; pide por WhatsApp.",
};

// Color de la barra del navegador según el tema; la tienda siempre es clara.
export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await getTheme()) === "pop" ? "#fff6dd" : "#ffffff", colorScheme: "light" };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await getTheme();
  return (
    <html lang="es" data-theme={theme} className={`${geist.variable} ${archivo.variable} ${bowlby.variable} ${bangers.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
