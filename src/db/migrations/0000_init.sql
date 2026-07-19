CREATE TYPE "public"."app_status" AS ENUM('running', 'stopped', 'building', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deployment_status" AS ENUM('queued', 'building', 'deploying', 'running', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."environment_name" AS ENUM('production', 'staging', 'development');--> statement-breakpoint
CREATE TYPE "public"."framework" AS ENUM('nextjs', 'nuxt', 'sveltekit', 'remix', 'adonisjs', 'django', 'rails', 'laravel', 'symfony', 'blazor', 'phoenix', 'static', 'other');--> statement-breakpoint
CREATE TYPE "public"."server_status" AS ENUM('online', 'offline', 'provisioning');--> statement-breakpoint
CREATE TYPE "public"."service_category" AS ENUM('database', 'cache', 'storage', 'search', 'queue', 'analytics');--> statement-breakpoint
CREATE TYPE "public"."ssl_status" AS ENUM('active', 'pending', 'failed');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment" "environment_name" DEFAULT 'production' NOT NULL,
	"name" text NOT NULL,
	"framework" "framework" DEFAULT 'other' NOT NULL,
	"repo_url" text NOT NULL,
	"branch" text DEFAULT 'main' NOT NULL,
	"build_command" text,
	"install_command" text,
	"start_command" text,
	"output_directory" text,
	"port" integer DEFAULT 3000 NOT NULL,
	"status" "app_status" DEFAULT 'stopped' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"status" "deployment_status" DEFAULT 'queued' NOT NULL,
	"commit_sha" text NOT NULL,
	"commit_message" text NOT NULL,
	"branch" text NOT NULL,
	"triggered_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_sec" integer
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"ssl_status" "ssl_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domains_hostname_unique" UNIQUE("hostname")
);
--> statement-breakpoint
CREATE TABLE "env_vars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"environment" "environment_name" DEFAULT 'production' NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"server_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"status" "server_status" DEFAULT 'provisioning' NOT NULL,
	"cpu_cores" integer DEFAULT 0 NOT NULL,
	"memory_mb" integer DEFAULT 0 NOT NULL,
	"disk_gb" integer DEFAULT 0 NOT NULL,
	"cpu_usage_pct" real DEFAULT 0 NOT NULL,
	"memory_usage_pct" real DEFAULT 0 NOT NULL,
	"disk_usage_pct" real DEFAULT 0 NOT NULL,
	"docker_version" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment" "environment_name" DEFAULT 'production' NOT NULL,
	"template_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"status" "app_status" DEFAULT 'stopped' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" "service_category" NOT NULL,
	"default_version" text NOT NULL,
	CONSTRAINT "service_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_vars" ADD CONSTRAINT "env_vars_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_instances" ADD CONSTRAINT "service_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_instances" ADD CONSTRAINT "service_instances_template_id_service_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."service_templates"("id") ON DELETE restrict ON UPDATE no action;