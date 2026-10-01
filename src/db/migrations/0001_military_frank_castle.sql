ALTER TABLE "settings" ALTER COLUMN "whatsapp_number" SET DEFAULT '';--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_variant_id_idx" ON "order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_confirmed_at_idx" ON "orders" USING btree ("confirmed_at");--> statement-breakpoint
UPDATE "settings" SET "whatsapp_number" = '' WHERE "whatsapp_number" = '3000000000';
