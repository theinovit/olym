import { mockDomains } from "@/lib/mock-data";
import type { Domain } from "@/lib/types";
import { getDb, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import { isDatabaseEnabled } from "../env";
import { serializeDates } from "./mappers";

export async function listDomains(): Promise<Domain[]> {
  if (!isDatabaseEnabled()) return mockDomains;
  const rows = await getDb().select().from(schema.domains).orderBy(asc(schema.domains.createdAt));
  return rows.map((row) => serializeDates<Domain>(row));
}

export async function getDomain(id: string): Promise<Domain | null> {
  if (!isDatabaseEnabled()) {
    return mockDomains.find((domain) => domain.id === id) ?? null;
  }
  const [row] = await getDb().select().from(schema.domains).where(eq(schema.domains.id, id)).limit(1);
  return row ? serializeDates<Domain>(row) : null;
}
