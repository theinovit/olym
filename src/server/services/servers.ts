// The local Docker host is always available; remote hosts via SSH remain F2.

import type { Server } from "@/lib/types";
import { mockServers } from "@/lib/mock-data";
import { getDb, schema } from "@/db";
import { asc, eq, sql } from "drizzle-orm";
import { createDockerClient } from "../docker";
import { isDatabaseEnabled } from "../env";
import { NotImplementedError } from "../errors";
import { serializeDates } from "./mappers";

export async function listServers(): Promise<Server[]> {
  if (!isDatabaseEnabled()) return mockServers;
  let rows = await getDb()
    .select()
    .from(schema.servers)
    .orderBy(asc(schema.servers.createdAt));
  if (rows.length === 0) {
    const dockerInfo = await createDockerClient().info();
    await getDb().transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext('olym-local-server-bootstrap'))`,
      );
      const [existing] = await transaction
        .select({ id: schema.servers.id })
        .from(schema.servers)
        .limit(1);
      if (!existing) {
        await transaction.insert(schema.servers).values({
          name: "This server",
          host: process.env.OLYM_PUBLIC_IP?.trim() || "this-server",
          status: "online",
          cpuCores: dockerInfo.NCPU,
          memoryMb: Math.floor(dockerInfo.MemTotal / 1024 / 1024),
          dockerVersion: dockerInfo.ServerVersion,
        });
      }
    });
    rows = await getDb()
      .select()
      .from(schema.servers)
      .orderBy(asc(schema.servers.createdAt));
  }
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
