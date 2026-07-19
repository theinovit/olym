import { dataResponse } from "@/server/http";
import { listApplications } from "@/server/services/applications";

export async function GET() {
  return dataResponse(await listApplications());
}
