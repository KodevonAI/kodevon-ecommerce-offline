import type { Metadata } from "next";
import { LegalPage } from "@/components/store/LegalPage";

export const metadata: Metadata = { title: "Términos de compra", description: "Cómo funcionan los pedidos, precios, stock y envíos en OFFLINE." };

export default function TermsPage() {
  return (
    <LegalPage title="Términos de compra" updated="1 de octubre de 2026">
      <section>
        <h2>Cómo funciona un pedido</h2>
        <p>Armas tu carrito, dejas tu nombre y celular, y se abre WhatsApp con tu pedido escrito. El pedido queda pendiente hasta que lo confirmamos contigo por ese medio. Enviar el pedido no es una compra cerrada.</p>
      </section>
      <section>
        <h2>Precios</h2>
        <p>Los precios están en pesos colombianos (COP) y corresponden a los productos. El envío no está incluido: se acuerda por WhatsApp al confirmar.</p>
      </section>
      <section>
        <h2>Disponibilidad</h2>
        <p>El inventario se descuenta cuando confirmamos el pedido, no cuando lo envías. Si una prenda se agotó entre tanto, te avisamos y te proponemos una alternativa.</p>
      </section>
      <section>
        <h2>Pago y envío</h2>
        <p>No hay pagos en línea. Acordamos contigo la forma de pago y el envío por WhatsApp.</p>
      </section>
      <section>
        <h2>Cancelaciones</h2>
        <p>Puedes pedir cancelar tu pedido por WhatsApp. Si ya estaba confirmado, devolvemos las unidades al inventario.</p>
      </section>
    </LegalPage>
  );
}
