"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { buildWaUrl } from "@/lib/whatsapp";

// Donde ya hay una acción principal o un formulario no estorbamos; en producto solo en escritorio (hay barra de compra fija).
const HIDDEN = ["/checkout", "/carrito", "/pedido"];

export function WhatsAppFab({ whatsappNumber }: { whatsappNumber: string }) {
  const pathname = usePathname();
  if (!whatsappNumber || HIDDEN.some((p) => pathname.startsWith(p))) return null;
  const onProduct = pathname.startsWith("/producto/");
  return (
    <a
      href={buildWaUrl(whatsappNumber, "Hola OFFLINE, tengo una pregunta")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className={`fixed bottom-5 right-5 z-40 size-12 place-items-center rounded-full bg-ink text-paper shadow-[0_8px_24px_rgb(0_0_0/0.25)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink ${onProduct ? "hidden md:grid" : "grid"}`}
    >
      <MessageCircle className="size-6" strokeWidth={1.75} aria-hidden />
    </a>
  );
}
