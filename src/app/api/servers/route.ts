import { dataResponse } from "@/server/http";
import { listServers } from "@/server/services/servers";

export async function GET() {
  return dataResponse(await listServers());
}
