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

const productBase = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(120, "El nombre es muy largo (máx. 120)"),
  description: z.string().trim().max(4000, "La descripción es muy larga (máx. 4000)").default(""),
  categoryId: z.coerce.number().int("Categoría inválida").positive("Categoría inválida").nullable(),
  price: z.coerce.number().int("El precio debe ser un número entero").min(1, "El precio debe ser mayor a 0"),
  salePrice: z.coerce.number().int("La oferta debe ser un número entero").min(1, "La oferta debe ser mayor a 0").nullable(),
  active: z.boolean(),
});

export const productSchema = productBase.refine((p) => p.salePrice === null || p.salePrice < p.price, {
  message: "La oferta debe ser menor al precio", path: ["salePrice"],
});

export const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/.+/i;

export const productFullSchema = productBase
  .extend({
    colorName: z.string().trim().min(1, "Ponle nombre al color").max(40, "El nombre del color es muy largo (máx. 40)"),
    colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
    modelId: z.string().min(1, "Modelo inválido").max(64, "Modelo inválido").optional(),
    images: z.array(z.string().regex(BLOB_URL, "Foto inválida")).max(12, "Máximo 12 fotos"),
    variants: z.array(z.object({
      size: z.string().trim().min(1, "Talla vacía").max(10, "Talla muy larga (máx. 10)"),
      stock: z.number().int("El stock debe ser un número entero").min(0, "El stock no puede ser negativo").max(100000, "Stock demasiado alto"),
    })).min(1, "Agrega al menos una talla").max(30, "Máximo 30 tallas"),
  })
  .refine((p) => p.salePrice === null || p.salePrice < p.price, { message: "La oferta debe ser menor al precio", path: ["salePrice"] })
  .refine((p) => new Set(p.variants.map((v) => v.size.trim().toUpperCase())).size === p.variants.length, { message: "Hay tallas repetidas", path: ["variants"] });
export type ProductFullInput = z.infer<typeof productFullSchema>;

export const settingsSchema = z.object({
  whatsappNumber: z.string().transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Número inválido" });
    return n ?? "";
  }),
  storeName: z.string().trim().min(1).max(40),
  lowStockThreshold: z.coerce.number().int().min(0).max(100),
});
