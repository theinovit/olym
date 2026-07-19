import { dataResponse } from "@/server/http";
import { listDomains } from "@/server/services/domains";

export async function GET() {
  return dataResponse(await listDomains());
}
