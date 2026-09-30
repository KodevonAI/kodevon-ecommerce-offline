import { sql } from "drizzle-orm";
import {
  boolean, check, integer, pgEnum, pgSequence, pgTable, serial, text,
  timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

export const orderStatus = pgEnum("order_status", ["pending", "confirmed", "cancelled"]);
export const stockReason = pgEnum("stock_reason", ["order_confirmed", "order_cancelled", "manual"]);
export const orderCodeSeq = pgSequence("order_code_seq");

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  position: integer("position").notNull().default(0),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id),
  price: integer("price").notNull(),
  salePrice: integer("sale_price"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
});

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    colorName: text("color_name").notNull(),
    colorHex: text("color_hex").notNull().default("#000000"),
    stock: integer("stock").notNull().default(0),
    sku: text("sku"),
  },
  (t) => [
    uniqueIndex("variants_unique").on(t.productId, t.size, t.colorName),
    check("variants_stock_nonneg", sql`${t.stock} >= 0`),
  ],
);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  status: orderStatus("status").notNull().default("pending"),
  total: integer("total").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  size: text("size").notNull(),
  colorName: text("color_name").notNull(),
  unitPrice: integer("unit_price").notNull(),
  qty: integer("qty").notNull(),
});

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: stockReason("reason").notNull(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  whatsappNumber: text("whatsapp_number").notNull().default("3000000000"),
  storeName: text("store_name").notNull().default("OFFLINE"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});
