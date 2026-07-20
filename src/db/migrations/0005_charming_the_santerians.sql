ALTER TABLE "applications" ALTER COLUMN "repo_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "docker_image" text;