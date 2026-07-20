import { z } from "zod";

import { dataResponse, errorResponse } from "@/server/http";
import { DomainError } from "@/server/errors";
import {
  createBinding,
  deleteBinding,
  listBindings,
} from "@/server/services/bindings";

const createBindingSchema = z.object({
  applicationId: z.string().trim().min(1),
  serviceInstanceId: z.string().trim().min(1),
});
const deleteBindingSchema = z.object({ id: z.string().trim().min(1) });

function domainErrorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return errorResponse(error.status, error.code, error.message);
  }
  console.error("Bindings API error", error);
  return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred.");
}

export async function GET() {
  try {
    return dataResponse(await listBindings());
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = createBindingSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(400, "VALIDATION_ERROR", result.error.issues[0]?.message ?? "Invalid binding.");
  }
  try {
    return dataResponse(await createBinding(result.data), { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const urlId = new URL(request.url).searchParams.get("id");
  let body: unknown = { id: urlId };
  if (!urlId) {
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_JSON", "Provide the binding id in the query or JSON body.");
    }
  }
  const result = deleteBindingSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(400, "VALIDATION_ERROR", result.error.issues[0]?.message ?? "Invalid binding id.");
  }
  try {
    if (!(await deleteBinding(result.data.id))) {
      return errorResponse(404, "BINDING_NOT_FOUND", "Binding not found.");
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
