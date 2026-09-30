import { describe, it, expect } from "vitest";
import { formatCop } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { buildOrderMessage, buildWaUrl, buildCustomerChatUrl } from "@/lib/whatsapp";
import { checkoutSchema } from "@/lib/validators";

describe("formatCop", () => {
  it("formatea con puntos", () => {
    expect(formatCop(89900)).toBe("$89.900");
    expect(formatCop(1250000)).toBe("$1.250.000");
    expect(formatCop(0)).toBe("$0");
  });
});

describe("normalizePhone", () => {
  it("acepta formatos comunes", () => {
    expect(normalizePhone("3001234567")).toBe("3001234567");
    expect(normalizePhone("+57 300 123 4567")).toBe("3001234567");
    expect(normalizePhone("300-123-4567")).toBe("3001234567");
    expect(normalizePhone("573001234567")).toBe("3001234567");
  });
  it("rechaza inválidos", () => {
    expect(normalizePhone("300123456")).toBeNull();     // 9 dígitos
    expect(normalizePhone("30012345678")).toBeNull();   // 11 dígitos
    expect(normalizePhone("2001234567")).toBeNull();    // no inicia en 3
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("whatsapp", () => {
  const lines = [{ productName: "Camiseta Oversize", size: "M", colorName: "Negro", qty: 2, unitPrice: 89900 }];
  it("arma el mensaje", () => {
    const m = buildOrderMessage({ code: "OFF-0001", name: "Juan Pérez", lines, total: 179800 });
    expect(m).toContain("pedido OFF-0001");
    expect(m).toContain("Nombre: Juan Pérez");
    expect(m).toContain("• Camiseta Oversize - Negro / M x2 - $179.800");
    expect(m).toContain("Total productos: $179.800");
    expect(m).toContain("(envío por acordar)");
  });
  it("nombre con &, #, %, emoji y salto de línea llega íntegro y en una línea", () => {
    const m = buildOrderMessage({ code: "OFF-0002", name: "Ana & Co #1 100%\n😀", lines, total: 1 });
    expect(m.split("\n").filter((l) => l.startsWith("Nombre:"))).toHaveLength(1);
    const url = buildWaUrl("3001234567", m);
    const text = new URL(url).searchParams.get("text")!;
    expect(text).toBe(m);
    expect(url.startsWith("https://wa.me/573001234567?text=")).toBe(true);
  });
  it("chat del cliente", () => {
    expect(buildCustomerChatUrl("3001234567")).toBe("https://wa.me/573001234567");
  });
});

describe("checkoutSchema", () => {
  const ok = { name: "Juan", phone: "300 123 4567", items: [{ variantId: 1, qty: 2 }] };
  it("acepta válido y normaliza teléfono", () => {
    expect(checkoutSchema.parse(ok).phone).toBe("3001234567");
  });
  it.each([0, -1, 1.5, 100])("rechaza qty %s", (qty) => {
    expect(checkoutSchema.safeParse({ ...ok, items: [{ variantId: 1, qty }] }).success).toBe(false);
  });
  it("rechaza carrito vacío, nombre vacío y teléfono inválido", () => {
    expect(checkoutSchema.safeParse({ ...ok, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, name: "  " }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, phone: "123" }).success).toBe(false);
  });
});
