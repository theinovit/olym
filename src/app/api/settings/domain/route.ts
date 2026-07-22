import { z } from "zod";

import {
  configureDomain,
  DomainDnsError,
  getDomainSettings,
} from "@/server/domain-settings";
import { errorResponse } from "@/server/http";

const hostnamePattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const domainSchema = z.object({
  hostname: z.string().trim().toLowerCase().regex(hostnamePattern),
  acmeEmail: z.email().trim().toLowerCase(),
});

export async function GET() {
  const settings = await getDomainSettings();
  if (!settings) {
    return errorResponse(
      404,
      "INSTANCE_SETTINGS_NOT_FOUND",
      "Instance settings have not been configured.",
    );
  }
  return Response.json(settings);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = domainSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Invalid domain settings.",
    );
  }

  try {
    return Response.json(await configureDomain(result.data));
  } catch (error) {
    if (error instanceof DomainDnsError) {
      return errorResponse(400, "DOMAIN_DNS_MISMATCH", error.message);
    }
    console.error("Domain settings API error", error);
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred.");
  }
}
