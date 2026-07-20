import { z } from "zod";

import { dataResponse, errorResponse } from "@/server/http";
import { updateApplicationPosition } from "@/server/services/applications";

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
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
  const result = positionSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(400, "VALIDATION_ERROR", result.error.issues[0]?.message ?? "Invalid position.");
  }
  const { id } = await params;
  if (!(await updateApplicationPosition(id, result.data))) {
    return errorResponse(404, "APPLICATION_NOT_FOUND", "Application not found.");
  }
  return dataResponse({ id, ...result.data });
}
