ALTER TABLE "vouchers" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_code_unique" UNIQUE("code");