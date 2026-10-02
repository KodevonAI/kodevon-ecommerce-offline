/**
 * Textos de envío, cambios y pago que se muestran en producto, carrito y home.
 * Describen cómo funciona hoy la tienda (todo se acuerda por WhatsApp). Cuando haya una política
 * formal (plazos, costos, umbral de envío gratis), se edita aquí y se actualiza en todas partes.
 */
export const STORE_INFO = {
  shipping: "El envío se acuerda por WhatsApp al confirmar tu pedido: ciudad, costo y tiempo de entrega.",
  returns: "Los cambios y devoluciones se coordinan por WhatsApp. Escríbenos con tu código de pedido y lo resolvemos contigo.",
  payment: "No hay pagos en línea. Acordamos la forma de pago contigo por WhatsApp.",
} as const;

export const TRUST_POINTS = [
  { title: "Sin cuentas", body: "Pides con tu nombre y tu celular." },
  { title: "Confirmamos por WhatsApp", body: "Revisamos disponibilidad contigo." },
  { title: "Envío acordado", body: "Ciudad, costo y tiempo, por WhatsApp." },
  { title: "Cambios y devoluciones", body: "Se coordinan por WhatsApp." },
] as const;
