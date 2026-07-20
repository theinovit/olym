import { dataResponse } from "@/server/http";
import { serviceCatalog } from "@/server/catalog";

export async function GET() {
  return dataResponse(serviceCatalog);
}
