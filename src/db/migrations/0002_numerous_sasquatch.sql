DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.name, ', ' ORDER BY p.name) INTO bad FROM products p
  WHERE (SELECT count(DISTINCT v.color_name) FROM variants v WHERE v.product_id = p.id) > 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Divide estos productos por color antes de migrar: %', bad;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "color_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "color_hex" text DEFAULT '#000000' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "model_id" text;
--> statement-breakpoint
UPDATE "products" p SET "color_name" = v.color_name, "color_hex" = v.color_hex
FROM (SELECT DISTINCT ON (product_id) product_id, color_name, color_hex FROM variants ORDER BY product_id, id) v
WHERE v.product_id = p.id;
--> statement-breakpoint
UPDATE "products" SET "model_id" = 'm-' || "id";
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "model_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "model_id" SET DEFAULT gen_random_uuid()::text;
--> statement-breakpoint
ALTER TABLE "variants" ALTER COLUMN "color_name" SET DEFAULT '';
--> statement-breakpoint
CREATE INDEX "products_model_id_idx" ON "products" USING btree ("model_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "variants_product_size_unique" ON "variants" USING btree ("product_id","size");
