import { z } from "zod";

import { DomainError } from "@/server/errors";
import { validateRepository } from "@/server/git";
import { dataResponse, errorResponse } from "@/server/http";

const requestSchema = z.object({
  repoUrl: z.string().trim().url(),
  token: z.string().trim().min(1).optional(),
});

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10_000;
const requestsByIp = new Map<string, number[]>();

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestsByIp.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS,
  );
  recent.push(now);
  requestsByIp.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

export async function POST(request: Request) {
  if (isRateLimited(clientIp(request))) {
    return errorResponse(429, "RATE_LIMITED", "Too many repository validation requests.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = requestSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Invalid request body.",
    );
  }

  try {
    const validation = await validateRepository(
      result.data.repoUrl,
      result.data.token,
    );
    if (!validation.accessible) {
      return errorResponse(
        404,
        "REPOSITORY_NOT_ACCESSIBLE",
        "Repository could not be accessed.",
      );
    }
    return dataResponse(validation);
  } catch (error) {
    if (error instanceof DomainError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(400, "GIT_VALIDATION_FAILED", "Repository validation failed.");
  }
}
