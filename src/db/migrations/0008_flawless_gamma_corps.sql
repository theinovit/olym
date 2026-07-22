CREATE TYPE "public"."instance_ssl_status" AS ENUM('none', 'pending', 'active', 'failed');--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "acme_email" text;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "ssl_status" "instance_ssl_status" DEFAULT 'none' NOT NULL;