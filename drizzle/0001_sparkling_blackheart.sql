CREATE TABLE "item_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"rate" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"voucher_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"paid_at" timestamp DEFAULT now(),
	CONSTRAINT "payouts_voucher_id_unique" UNIQUE("voucher_id")
);
--> statement-breakpoint
CREATE TABLE "voucher_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"voucher_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"qty" integer NOT NULL,
	"rate" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"rejected_qty" integer DEFAULT 0,
	"reject_note" text
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"status" text DEFAULT 'on_process',
	"total_qty" integer DEFAULT 0,
	"total_amount" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "item_rates" ADD CONSTRAINT "item_rates_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_details" ADD CONSTRAINT "voucher_details_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_details" ADD CONSTRAINT "voucher_details_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;