import { cookies } from "next/headers";
import { z } from "zod";

import { setupAdminAccount } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { dataResponse, errorResponse } from "@/server/http";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/server/session";

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(256),
  instanceName: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = credentialsSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Invalid credentials.",
    );
  }

  try {
    const user = await setupAdminAccount(
      result.data.email,
      result.data.password,
      result.data.instanceName,
    );
    (await cookies()).set(
      SESSION_COOKIE_NAME,
      createSessionToken(user.id),
      sessionCookieOptions,
    );
    return dataResponse({ email: user.email }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "AUTH_SETUP_FAILED", "Account setup failed.");
  }
}
