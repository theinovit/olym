import { z } from "zod";

import { dataResponse, errorResponse } from "@/server/http";
import { createService } from "@/server/services/services";

const serviceSchema = z.object({
  projectId: z.string().trim().min(1),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  templateId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  version: z.string().trim().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = serviceSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(400, "VALIDATION_ERROR", result.error.issues[0]?.message ?? "Invalid request body.");
  }
  return dataResponse(await createService(result.data), { status: 202 });
}
