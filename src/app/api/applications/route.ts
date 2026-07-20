import { z } from "zod";

import { DomainError } from "@/server/errors";
import { validateRepository } from "@/server/git";
import { dataResponse, errorResponse } from "@/server/http";
import {
  createApplication,
  listApplications,
} from "@/server/services/applications";

const applicationSchema = z.object({
  projectId: z.string().trim().min(1),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  name: z.string().trim().min(1),
  framework: z.enum(["nextjs", "nuxt", "sveltekit", "remix", "adonisjs", "django", "rails", "laravel", "symfony", "blazor", "phoenix", "static", "other"]),
  repoUrl: z.string().trim().url(),
  branch: z.string().trim().min(1).default("main"),
  buildCommand: z.string().nullable().default(null),
  installCommand: z.string().nullable().default(null),
  startCommand: z.string().nullable().default(null),
  outputDirectory: z.string().nullable().default(null),
  port: z.number().int().min(1).max(65535).default(3000),
});

export async function GET() {
  return dataResponse(await listApplications());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = applicationSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(400, "VALIDATION_ERROR", result.error.issues[0]?.message ?? "Invalid request body.");
  }
  try {
    const repository = await validateRepository(result.data.repoUrl);
    if (!repository.accessible) {
      return errorResponse(
        400,
        "REPOSITORY_NOT_ACCESSIBLE",
        "Repository could not be accessed.",
      );
    }
    if (!repository.branches.includes(result.data.branch)) {
      return errorResponse(
        400,
        "REPOSITORY_BRANCH_NOT_FOUND",
        "Repository branch could not be found.",
      );
    }
    return dataResponse(await createApplication(result.data), { status: 202 });
  } catch (error) {
    if (error instanceof DomainError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(
      400,
      "GIT_VALIDATION_FAILED",
      "Repository validation failed.",
    );
  }
}
