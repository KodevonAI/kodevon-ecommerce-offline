import type { Metadata } from "next";
import { LegalPage } from "@/components/store/LegalPage";
import { storeSettings } from "@/server/cached";
import { buildCustomerChatUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Política de privacidad", description: "Qué datos pedimos en OFFLINE, para qué los usamos y cómo ejercer tus derechos." };

export default async function PrivacyPage() {
  const s = await storeSettings();
  const storeName = s.storeName || "OFFLINE";
  return (
    <LegalPage title="Política de privacidad" updated="1 de octubre de 2026">
      <section>
        <h2>Quién es el responsable</h2>
        <p>
          {storeName} es responsable del tratamiento de los datos que dejas en esta tienda, conforme a la Ley 1581 de 2012 (Colombia).
          {s.whatsappNumber && (
            <> Puedes escribirnos por <a className="underline underline-offset-4" href={buildCustomerChatUrl(s.whatsappNumber)} target="_blank" rel="noopener noreferrer">WhatsApp</a> para cualquier consulta sobre tus datos.</>
          )}
        </p>
      </section>
      <section>
        <h2>Qué datos pedimos</h2>
        <ul>
          <li>Tu nombre y tu número de celular, solo cuando haces un pedido.</li>
          <li>El contenido de tu pedido: prendas, tallas, colores y cantidades.</li>
        </ul>
        <p className="mt-3">No pedimos correo, dirección ni datos de pago en esta web. No necesitas crear una cuenta.</p>
      </section>
      <section>
        <h2>Para qué los usamos</h2>
        <ul>
          <li>Confirmar tu pedido y escribirte por WhatsApp.</li>
          <li>Acordar contigo el envío y la forma de pago.</li>
          <li>Llevar el registro de ventas y de inventario de la tienda.</li>
        </ul>
        <p className="mt-3">No vendemos tus datos ni los usamos para publicidad de terceros.</p>
      </section>
      <section>
        <h2>Tus derechos</h2>
        <p>Puedes conocer, actualizar y rectificar tus datos, pedir que los eliminemos y revocar tu autorización cuando quieras. Escríbenos por WhatsApp y respondemos por el mismo medio.</p>
      </section>
      <section>
        <h2>Cookies y almacenamiento</h2>
        <p>Guardamos tu carrito en tu propio navegador (almacenamiento local) para que no lo pierdas al navegar. Ese dato no sale de tu dispositivo hasta que envías el pedido.</p>
      </section>
    </LegalPage>
  );
}
