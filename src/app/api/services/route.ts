import { dataResponse } from "@/server/http";
import { listServices } from "@/server/services/services";

export async function GET() {
  return dataResponse(await listServices());
}
