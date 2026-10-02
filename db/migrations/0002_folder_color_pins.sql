CREATE TYPE "public"."folder_color" AS ENUM('blue', 'coral', 'sun', 'mint', 'violet', 'aqua');--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "color" "folder_color" DEFAULT 'blue' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "items_pinned_idx" ON "items" USING btree ("owner_id","pinned_at");