import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

// Archivo con eje de ancho: el logotipo y los titulares usan la versión expandida.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: { default: "OFFLINE", template: "%s · OFFLINE" },
  description: "OFFLINE: ropa para desconectarse. Camisetas, buzos y pantalones; pide por WhatsApp.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${archivo.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
