import { z } from "zod";

import {
  getInstanceName,
  updateInstanceName,
} from "@/server/instance-settings";
import { errorResponse } from "@/server/http";

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET() {
  const name = await getInstanceName();
  if (!name) {
    return errorResponse(
      404,
      "INSTANCE_SETTINGS_NOT_FOUND",
      "Instance settings have not been configured.",
    );
  }
  return Response.json({ name });
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = settingsSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Invalid instance settings.",
    );
  }
  return Response.json({ name: await updateInstanceName(result.data.name) });
}
