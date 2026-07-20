import { z } from "zod";

import { dataResponse, errorResponse } from "@/server/http";
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

export async function GET() {
  return dataResponse(await listBindings());
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
  return dataResponse(await createBinding(result.data), { status: 201 });
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
  if (!(await deleteBinding(result.data.id))) {
    return errorResponse(404, "BINDING_NOT_FOUND", "Binding not found.");
  }
  return new Response(null, { status: 204 });
}
