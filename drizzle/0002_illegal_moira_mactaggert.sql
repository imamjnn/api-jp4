CREATE TABLE "item_stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"type" text NOT NULL,
	"qty" integer NOT NULL,
	"note" text,
	"ref_type" text,
	"ref_id" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "item_stocks" ADD CONSTRAINT "item_stocks_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_stocks" ADD CONSTRAINT "item_stocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;