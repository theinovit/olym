import { z } from "zod";

import { dataResponse } from "@/server/http";
import { errorResponse } from "@/server/http";
import {
  createApplication,
  listApplications,
} from "@/server/services/applications";

const applicationSchema = z.object({
  projectId: z.string().trim().min(1),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  name: z.string().trim().min(1),
  framework: z.enum(["nextjs", "nuxt", "sveltekit", "remix", "adonisjs", "django", "rails", "laravel", "symfony", "blazor", "phoenix", "static", "other"]),
  repoUrl: z.string().trim().default(""),
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
  return dataResponse(await createApplication(result.data), { status: 202 });
}
