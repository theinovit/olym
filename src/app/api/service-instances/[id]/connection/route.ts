import { dataResponse, errorResponse } from "@/server/http";
import { getServiceConnection } from "@/server/services/connections";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const connectionString = await getServiceConnection(id);
    if (!connectionString) {
      return errorResponse(
        404,
        "SERVICE_NOT_FOUND",
        "Service instance not found.",
      );
    }
    return dataResponse({ connectionString });
  } catch (error) {
    console.error("Service connection API error", error);
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred.");
  }
}
