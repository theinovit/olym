import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  mockBindings,
  mockServiceInstances,
  mockServiceTemplates,
} from "@/lib/mock-data";
import type { Binding } from "@/lib/types";

import { isDatabaseEnabled } from "../env";
import { serializeDates } from "./mappers";
import { getService } from "./services";

const simulatedBindings: Binding[] = mockBindings.map((binding) => ({
  ...binding,
}));

function injectedVarKey(templateName: string): string {
  const normalized = templateName.toLowerCase();
  if (normalized.includes("postgres") || normalized.includes("mysql") || normalized.includes("mariadb")) return "DATABASE_URL";
  if (normalized.includes("redis")) return "REDIS_URL";
  if (normalized.includes("mongo")) return "MONGODB_URI";
  if (normalized.includes("minio")) return "S3_ENDPOINT";
  if (normalized.includes("meili")) return "MEILISEARCH_URL";
  if (normalized.includes("qdrant")) return "QDRANT_URL";
  if (normalized.includes("rabbit")) return "AMQP_URL";
  if (normalized.includes("clickhouse")) return "CLICKHOUSE_URL";
  return "SERVICE_URL";
}

export async function listBindings(): Promise<Binding[]> {
  if (!isDatabaseEnabled()) return simulatedBindings;
  const rows = await getDb().select().from(schema.bindings).orderBy(asc(schema.bindings.createdAt));
  return rows.map((row) => serializeDates<Binding>(row));
}

export async function createBinding(input: {
  applicationId: string;
  serviceInstanceId: string;
}): Promise<Binding> {
  if (!isDatabaseEnabled()) {
    const existing = simulatedBindings.find(
      (binding) => binding.applicationId === input.applicationId && binding.serviceInstanceId === input.serviceInstanceId,
    );
    if (existing) return existing;

    const service = await getService(input.serviceInstanceId);
    const mockService = mockServiceInstances.find((item) => item.id === input.serviceInstanceId);
    const template = mockServiceTemplates.find((item) => item.id === (service?.templateId ?? mockService?.templateId));
    const binding: Binding = {
      id: randomUUID(),
      ...input,
      injectedVarKey: injectedVarKey(template?.name ?? service?.templateId ?? "service"),
      createdAt: new Date().toISOString(),
    };
    simulatedBindings.push(binding);
    return binding;
  }

  const [service] = await getDb()
    .select({ templateName: schema.serviceTemplates.name })
    .from(schema.serviceInstances)
    .innerJoin(schema.serviceTemplates, eq(schema.serviceInstances.templateId, schema.serviceTemplates.id))
    .where(eq(schema.serviceInstances.id, input.serviceInstanceId))
    .limit(1);
  if (!service) throw new Error(`Service instance not found: ${input.serviceInstanceId}`);

  const [created] = await getDb()
    .insert(schema.bindings)
    .values({ ...input, injectedVarKey: injectedVarKey(service.templateName) })
    .onConflictDoNothing()
    .returning();
  if (created) return serializeDates<Binding>(created);

  const [existing] = await getDb()
    .select()
    .from(schema.bindings)
    .where(and(eq(schema.bindings.applicationId, input.applicationId), eq(schema.bindings.serviceInstanceId, input.serviceInstanceId)))
    .limit(1);
  return serializeDates<Binding>(existing);
}

export async function deleteBinding(id: string): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    const index = simulatedBindings.findIndex((binding) => binding.id === id);
    if (index < 0) return false;
    simulatedBindings.splice(index, 1);
    return true;
  }
  const rows = await getDb().delete(schema.bindings).where(eq(schema.bindings.id, id)).returning({ id: schema.bindings.id });
  return rows.length > 0;
}
