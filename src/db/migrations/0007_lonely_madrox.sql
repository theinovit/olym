CREATE TABLE "service_credentials" (
	"service_instance_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "service_credentials_service_instance_id_key_pk" PRIMARY KEY("service_instance_id","key")
);
--> statement-breakpoint
ALTER TABLE "service_credentials" ADD CONSTRAINT "service_credentials_service_instance_id_service_instances_id_fk" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE cascade ON UPDATE no action;