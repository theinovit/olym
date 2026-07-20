import { cookies } from "next/headers";

import { getUserById } from "@/server/auth";
import { dataResponse, errorResponse } from "@/server/http";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/server/session";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return errorResponse(401, "UNAUTHENTICATED", "Authentication is required.");
  }
  const user = await getUserById(session.userId);
  if (!user) {
    return errorResponse(401, "UNAUTHENTICATED", "Authentication is required.");
  }
  return dataResponse({ email: user.email });
}
