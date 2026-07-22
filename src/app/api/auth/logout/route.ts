import { cookies } from "next/headers";

import { dataResponse } from "@/server/http";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/server/session";

export async function POST(request: Request) {
  (await cookies()).set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(request),
    maxAge: 0,
  });
  return dataResponse({ loggedOut: true });
}
