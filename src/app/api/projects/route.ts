import { z } from "zod";

import { dataResponse, errorResponse } from "@/server/http";
import { createProject, listProjects } from "@/server/services/projects";

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  serverId: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable().optional(),
});

export async function GET() {
  return dataResponse(await listProjects());
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = createProjectSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Invalid request body.",
    );
  }

  return dataResponse(await createProject(result.data), { status: 201 });
}
