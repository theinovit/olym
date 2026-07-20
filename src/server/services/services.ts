import { mockServiceInstances } from "@/lib/mock-data";
import type { ServiceInstance } from "@/lib/types";
import { getDb, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import { isDatabaseEnabled } from "../env";
import { serializeDates } from "./mappers";

export async function listServices(): Promise<ServiceInstance[]> {
  if (!isDatabaseEnabled()) return mockServiceInstances;
  const rows = await getDb().select().from(schema.serviceInstances).orderBy(asc(schema.serviceInstances.createdAt));
  return rows.map((row) => serializeDates<ServiceInstance>(row));
}

export async function getService(id: string): Promise<ServiceInstance | null> {
  if (!isDatabaseEnabled()) {
    return mockServiceInstances.find((service) => service.id === id) ?? null;
  }
  const [row] = await getDb().select().from(schema.serviceInstances).where(eq(schema.serviceInstances.id, id)).limit(1);
  return row ? serializeDates<ServiceInstance>(row) : null;
}
