import { formatCop } from "./money";

export type MsgLine = { productName: string; size: string; colorName: string; qty: number; unitPrice: number };

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

export function buildOrderMessage(o: { code: string; name: string; lines: MsgLine[]; total: number }): string {
  const lines = o.lines.map(
    (l) => `• ${oneLine(l.productName)} - ${oneLine(l.colorName)} / ${oneLine(l.size)} x${l.qty} - ${formatCop(l.unitPrice * l.qty)}`,
  );
  return [
    `Hola OFFLINE, quiero hacer el pedido ${o.code}`,
    `Nombre: ${oneLine(o.name)}`,
    ...lines,
    `Total productos: ${formatCop(o.total)}`,
    "(envío por acordar)",
  ].join("\n");
}

export function buildWaUrl(storeNumber: string, text: string): string {
  return `https://wa.me/57${storeNumber}?text=${encodeURIComponent(text)}`;
}

export function buildCustomerChatUrl(phone: string): string {
  return `https://wa.me/57${phone}`;
}
