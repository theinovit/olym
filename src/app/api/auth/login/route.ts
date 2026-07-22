import { cookies } from "next/headers";
import { z } from "zod";

import { authenticateAdmin } from "@/server/auth";
import { dataResponse, errorResponse } from "@/server/http";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/server/session";

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(256),
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
    return errorResponse(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  try {
    const user = await authenticateAdmin(result.data.email, result.data.password);
    if (!user) {
      return errorResponse(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    (await cookies()).set(
      SESSION_COOKIE_NAME,
      createSessionToken(user.id),
      sessionCookieOptions(request),
    );
    return dataResponse({ email: user.email });
  } catch {
    return errorResponse(500, "AUTH_LOGIN_FAILED", "Authentication failed.");
  }
}
