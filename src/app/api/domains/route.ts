import { z } from "zod";

import { DomainError } from "@/server/errors";
import { dataResponse, errorResponse } from "@/server/http";
import { createDomain, listDomains } from "@/server/services/domains";

const domainSchema = z.object({
  applicationId: z.string().trim().min(1),
  hostname: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
      "Hostname is invalid.",
    ),
  isPrimary: z.boolean().default(false),
});

export async function GET() {
  return dataResponse(await listDomains());
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
      result.error.issues[0]?.message ?? "Invalid domain.",
    );
  }
  try {
    return dataResponse(await createDomain(result.data), { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "DOMAIN_CREATE_FAILED", "Domain creation failed.");
  }
}
