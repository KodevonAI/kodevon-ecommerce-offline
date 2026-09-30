import { z } from "zod";
import { normalizePhone } from "./phone";

export const MAX_QTY_PER_LINE = 20;

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(80),
  phone: z
    .string()
    .transform((v, ctx) => {
      const n = normalizePhone(v);
      if (!n) ctx.addIssue({ code: "custom", message: "Celular colombiano de 10 dígitos (ej. 300 123 4567)" });
      return n ?? "";
    }),
  items: z
    .array(z.object({
      variantId: z.number().int().positive(),
      qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
    }))
    .min(1, "El carrito está vacío")
    .max(50),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(50),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).default(""),
  categoryId: z.coerce.number().int().positive().nullable(),
  price: z.coerce.number().int().min(1),
  salePrice: z.coerce.number().int().min(1).nullable(),
  active: z.boolean(),
}).refine((p) => p.salePrice === null || p.salePrice < p.price, {
  message: "La oferta debe ser menor al precio", path: ["salePrice"],
});

export const settingsSchema = z.object({
  whatsappNumber: z.string().transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Número inválido" });
    return n ?? "";
  }),
  storeName: z.string().trim().min(1).max(40),
  lowStockThreshold: z.coerce.number().int().min(0).max(100),
});
