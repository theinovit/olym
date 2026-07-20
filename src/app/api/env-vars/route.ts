import { z } from "zod";

import { DomainError } from "@/server/errors";
import { dataResponse, errorResponse } from "@/server/http";
import { listEnvVars, setEnvVar } from "@/server/services/env-vars";

const environmentSchema = z.enum(["production", "staging", "development"]);
const createSchema = z.object({
  applicationId: z.string().trim().min(1),
  environment: environmentSchema,
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z_][A-Z0-9_]*$/, "Variable name is invalid."),
  value: z.string().min(1).max(65_536),
});

function apiError(error: unknown): Response {
  if (error instanceof DomainError) {
    return errorResponse(error.status, error.code, error.message);
  }
  return errorResponse(500, "ENV_VAR_ERROR", "Environment variable operation failed.");
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const result = z
    .object({
      applicationId: z.string().trim().min(1),
      environment: environmentSchema,
    })
    .safeParse({
      applicationId: searchParams.get("applicationId"),
      environment: searchParams.get("environment"),
    });
  if (!result.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid variable filters.");
  }
  try {
    return dataResponse(
      await listEnvVars(result.data.applicationId, result.data.environment),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = createSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Invalid environment variable.",
    );
  }
  try {
    return dataResponse(await setEnvVar(result.data), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
