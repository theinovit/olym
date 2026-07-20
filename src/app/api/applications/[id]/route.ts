import { z } from "zod";

import { dataResponse, errorResponse } from "@/server/http";
import { updateApplicationHealthCheck } from "@/server/services/applications";

const healthCheckSchema = z.object({
  healthCheckPath: z
    .string()
    .trim()
    .max(2_048)
    .regex(
      /^\/(?!\/)[^\s?#]*$/,
      "Health check path must be an absolute path without query or fragment.",
    )
    .nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = healthCheckSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Invalid health check path.",
    );
  }
  const { id } = await params;
  if (!(await updateApplicationHealthCheck(id, result.data.healthCheckPath))) {
    return errorResponse(404, "APPLICATION_NOT_FOUND", "Application not found.");
  }
  return dataResponse({ id, healthCheckPath: result.data.healthCheckPath });
}
