import { dataResponse, errorResponse } from "@/server/http";
import { listServers } from "@/server/services/servers";

export async function GET() {
  try {
    return dataResponse(await listServers());
  } catch (error) {
    console.error("Servers API error", error);
    return errorResponse(500, "INTERNAL_ERROR", "Could not load servers.");
  }
}
