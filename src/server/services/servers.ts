// Server service — F1 stubs. localhost via Docker socket in F2; SSH later.

import type { Server } from "@/lib/types";
import { mockServers } from "@/lib/mock-data";
import { getDb, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import { isDatabaseEnabled } from "../env";
import { NotImplementedError } from "../errors";
import { serializeDates } from "./mappers";

export async function listServers(): Promise<Server[]> {
  if (!isDatabaseEnabled()) return mockServers;
  const rows = await getDb().select().from(schema.servers).orderBy(asc(schema.servers.createdAt));
  return rows.map((row) => serializeDates<Server>(row));
}

export async function getServer(id: string): Promise<Server | null> {
  if (!isDatabaseEnabled()) return mockServers.find((server) => server.id === id) ?? null;
  const [row] = await getDb().select().from(schema.servers).where(eq(schema.servers.id, id)).limit(1);
  return row ? serializeDates<Server>(row) : null;
}

export async function addServer(
  input: Pick<Server, "name" | "host">,
): Promise<Server> {
  if (!isDatabaseEnabled()) throw new NotImplementedError("servers.addServer");
  const [row] = await getDb().insert(schema.servers).values(input).returning();
  return serializeDates<Server>(row);
}

export async function removeServer(id: string): Promise<void> {
  if (!isDatabaseEnabled()) throw new NotImplementedError("servers.removeServer");
  await getDb().delete(schema.servers).where(eq(schema.servers.id, id));
}
