CREATE TABLE "bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"service_instance_id" uuid NOT NULL,
	"injected_var_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "canvas_x" real;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "canvas_y" real;--> statement-breakpoint
ALTER TABLE "service_instances" ADD COLUMN "canvas_x" real;--> statement-breakpoint
ALTER TABLE "service_instances" ADD COLUMN "canvas_y" real;--> statement-breakpoint
ALTER TABLE "bindings" ADD CONSTRAINT "bindings_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bindings" ADD CONSTRAINT "bindings_service_instance_id_service_instances_id_fk" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bindings_application_service_unique" ON "bindings" USING btree ("application_id","service_instance_id");