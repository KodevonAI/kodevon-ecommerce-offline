import type { Metadata, Viewport } from "next";
import { Archivo, Geist } from "next/font/google";
import { siteUrl } from "@/lib/site";
import { getTheme } from "@/server/theme";
import "./globals.css";

const geist = Geist({ variable: "--font-body", subsets: ["latin"] });

// Archivo con eje de ancho: el logotipo y los titulares usan la versión expandida.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "OFFLINE", template: "%s · OFFLINE" },
  description: "OFFLINE: ropa para desconectarse. Camisetas, buzos y pantalones; pide por WhatsApp.",
};

// Color de la barra del navegador: sigue al sistema salvo que el visitante haya elegido un modo.
export async function generateViewport(): Promise<Viewport> {
  const forced = await getTheme();
  if (forced) return { themeColor: forced === "dark" ? "#000000" : "#ffffff", colorScheme: forced };
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#000000" },
    ],
    colorScheme: "light dark",
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await getTheme();
  return (
    <html lang="es" data-theme={theme} className={`${geist.variable} ${archivo.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
