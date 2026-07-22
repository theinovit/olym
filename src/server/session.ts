import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "olym_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface SessionPayload {
  userId: string;
  expiresAt: number;
}

function sessionSecret(): string {
  const secret = process.env.OLYM_SECRET?.trim();
  if (!secret) throw new Error("OLYM_SECRET is required for authentication");
  return secret;
}

function signature(payload: string): string {
  return createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      expiresAt: Math.floor(Date.now() / 1_000) + SESSION_MAX_AGE_SECONDS,
    } satisfies SessionPayload),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token) return null;
  const separator = token.indexOf(".");
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);

  try {
    const expectedSignature = signature(payload);
    const expected = Buffer.from(expectedSignature);
    const supplied = Buffer.from(suppliedSignature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      return null;
    }
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (
      typeof decoded.userId !== "string" ||
      typeof decoded.expiresAt !== "number" ||
      decoded.expiresAt <= Math.floor(Date.now() / 1_000)
    ) {
      return null;
    }
    return { userId: decoded.userId, expiresAt: decoded.expiresAt };
  } catch {
    return null;
  }
}

// Browsers silently refuse to store `Secure` cookies on a plain-HTTP origin
// (except localhost). Olym is reachable over HTTP-only on a bare IP until a
// domain is configured in Settings (see Sprint 22), so `secure` must reflect
// the actual connection instead of always being true — otherwise login
// "succeeds" server-side but the cookie never lands in the browser.
function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https";
  }
  return new URL(request.url).protocol === "https:";
}

export function sessionCookieOptions(request: Request) {
  return {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
