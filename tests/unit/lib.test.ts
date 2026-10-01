import { describe, it, expect } from "vitest";
import { formatCop } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { buildOrderMessage, buildWaUrl, buildCustomerChatUrl, buildReopenMessage } from "@/lib/whatsapp";
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

describe("buildReopenMessage", () => {
  it("no incluye datos del cliente", () => {
    expect(buildReopenMessage("OFF-0007")).toBe("Hola OFFLINE, te escribo por mi pedido OFF-0007");
  });
});

import { productFullSchema } from "@/lib/validators";

describe("productFullSchema", () => {
  const ok = {
    name: "Blusa Basic", description: "", categoryId: null, price: 50000, salePrice: null, active: true,
    colorName: "Rojo", colorHex: "#ff0000",
    images: ["https://abc123.public.blob.vercel-storage.com/products/1-foto.jpg"],
    variants: [{ size: "S", stock: 3 }, { size: "M", stock: 0 }],
  };
  it("acepta un producto válido", () => expect(productFullSchema.safeParse(ok).success).toBe(true));
  it.each(["http://abc.public.blob.vercel-storage.com/a.jpg", "javascript:alert(1)", "https://evil.com/a.jpg", "https://abc.public.blob.vercel-storage.com.evil.com/a.jpg", ""])(
    "rechaza la foto %s", (url) => expect(productFullSchema.safeParse({ ...ok, images: [url] }).success).toBe(false));
  it.each(["red", "#fff", "#GGGGGG", "ff0000", ""])("rechaza el color %s", (colorHex) =>
    expect(productFullSchema.safeParse({ ...ok, colorHex }).success).toBe(false));
  it("exige color con nombre, al menos una talla y tallas sin repetir (ignorando mayúsculas)", () => {
    expect(productFullSchema.safeParse({ ...ok, colorName: "  " }).success).toBe(false);
    expect(productFullSchema.safeParse({ ...ok, variants: [] }).success).toBe(false);
    expect(productFullSchema.safeParse({ ...ok, variants: [{ size: "m", stock: 1 }, { size: "M", stock: 2 }] }).success).toBe(false);
  });
  it("rechaza stock negativo o fraccionario y oferta mayor o igual al precio", () => {
    expect(productFullSchema.safeParse({ ...ok, variants: [{ size: "S", stock: -1 }] }).success).toBe(false);
    expect(productFullSchema.safeParse({ ...ok, variants: [{ size: "S", stock: 1.5 }] }).success).toBe(false);
    expect(productFullSchema.safeParse({ ...ok, salePrice: 50000 }).success).toBe(false);
  });
  it("devuelve mensajes en español", () => {
    const msg = (o: object) => {
      const r = productFullSchema.safeParse({ ...ok, ...o });
      return r.success ? [] : r.error.issues.map((i) => i.message);
    };
    const url = "https://abc123.public.blob.vercel-storage.com/products/1-foto.jpg";
    expect(msg({ images: Array(13).fill(url) })).toContain("Máximo 12 fotos");
    expect(msg({ colorName: "x".repeat(41) })).toContain("El nombre del color es muy largo (máx. 40)");
    expect(msg({ variants: [{ size: "x".repeat(11), stock: 1 }] })).toContain("Talla muy larga (máx. 10)");
    expect(msg({ variants: Array.from({ length: 31 }, (_, i) => ({ size: `T${i}`, stock: 1 })) })).toContain("Máximo 30 tallas");
    expect(msg({ variants: [{ size: "S", stock: -1 }] })).toContain("El stock no puede ser negativo");
    expect(msg({ variants: [{ size: "S", stock: 1.5 }] })).toContain("El stock debe ser un número entero");
    expect(msg({ name: "x".repeat(121) })).toContain("El nombre es muy largo (máx. 120)");
    expect(msg({ description: "x".repeat(4001) })).toContain("La descripción es muy larga (máx. 4000)");
  });
  it("acepta números JSON, categoryId null y también coacciona strings numéricos", () => {
    const a = productFullSchema.safeParse({ ...ok, categoryId: 3, price: 50000, salePrice: 40000 });
    expect(a.success && a.data.categoryId === 3 && a.data.salePrice === 40000).toBe(true);
    const b = productFullSchema.safeParse(ok);
    expect(b.success && b.data.categoryId === null && b.data.salePrice === null).toBe(true);
    const c = productFullSchema.safeParse({ ...ok, categoryId: "3", price: "50000", salePrice: "40000" });
    expect(c.success && c.data.categoryId === 3 && c.data.price === 50000 && c.data.salePrice === 40000).toBe(true);
  });
});
