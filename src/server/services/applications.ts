import { mockApplications } from "@/lib/mock-data";
import type { Application } from "@/lib/types";
import { getDb, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import { isDatabaseEnabled } from "../env";
import { serializeDates } from "./mappers";

export async function listApplications(): Promise<Application[]> {
  if (!isDatabaseEnabled()) return mockApplications;
  const rows = await getDb().select().from(schema.applications).orderBy(asc(schema.applications.createdAt));
  return rows.map((row) => serializeDates<Application>(row));
}

export async function getApplication(id: string): Promise<Application | null> {
  if (!isDatabaseEnabled()) {
    return mockApplications.find((application) => application.id === id) ?? null;
  }
  const [row] = await getDb().select().from(schema.applications).where(eq(schema.applications.id, id)).limit(1);
  return row ? serializeDates<Application>(row) : null;
}
