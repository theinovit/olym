import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  mockBindings,
  mockServiceInstances,
  mockServiceTemplates,
} from "@/lib/mock-data";
import type { Binding } from "@/lib/types";

import { isDatabaseEnabled } from "../env";
import { ConflictError, NotFoundError } from "../errors";
import { serviceCatalog } from "../catalog";
import { decryptCredential } from "../credentials-crypto";
import { getApplication } from "./applications";
import { serializeDates } from "./mappers";
import { getService } from "./services";
import {
  serviceConnectionString,
  serviceContainerName,
  type ServiceCredentials,
} from "./service-runtime";

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
  const [application, serviceInstance] = await Promise.all([
    getApplication(input.applicationId),
    getService(input.serviceInstanceId),
  ]);
  if (!application) {
    throw new NotFoundError(`Application not found: ${input.applicationId}`);
  }
  if (!serviceInstance) {
    throw new NotFoundError(
      `Service instance not found: ${input.serviceInstanceId}`,
    );
  }

  if (!isDatabaseEnabled()) {
    const existing = simulatedBindings.find(
      (binding) => binding.applicationId === input.applicationId && binding.serviceInstanceId === input.serviceInstanceId,
    );
    if (existing) {
      throw new ConflictError(
        "BINDING_ALREADY_EXISTS",
        "This application is already bound to this service instance.",
      );
    }

    const mockService = mockServiceInstances.find((item) => item.id === input.serviceInstanceId);
    const template = mockServiceTemplates.find((item) => item.id === (serviceInstance.templateId ?? mockService?.templateId));
    const binding: Binding = {
      id: randomUUID(),
      ...input,
      injectedVarKey: injectedVarKey(template?.name ?? serviceInstance.templateId),
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
  if (!service) {
    throw new NotFoundError(
      `Service template not found for instance: ${input.serviceInstanceId}`,
    );
  }

  const [existing] = await getDb()
    .select()
    .from(schema.bindings)
    .where(and(eq(schema.bindings.applicationId, input.applicationId), eq(schema.bindings.serviceInstanceId, input.serviceInstanceId)))
    .limit(1);
  if (existing) {
    throw new ConflictError(
      "BINDING_ALREADY_EXISTS",
      "This application is already bound to this service instance.",
    );
  }

  const [created] = await getDb()
    .insert(schema.bindings)
    .values({ ...input, injectedVarKey: injectedVarKey(service.templateName) })
    .onConflictDoNothing()
    .returning();
  if (created) return serializeDates<Binding>(created);
  throw new ConflictError(
    "BINDING_ALREADY_EXISTS",
    "This application is already bound to this service instance.",
  );
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

export async function getBindingEnvironment(
  applicationId: string,
): Promise<Record<string, string>> {
  if (!isDatabaseEnabled()) return {};

  const boundServices = await getDb()
    .select({
      injectedVarKey: schema.bindings.injectedVarKey,
      serviceInstanceId: schema.serviceInstances.id,
      templateName: schema.serviceTemplates.name,
    })
    .from(schema.bindings)
    .innerJoin(
      schema.serviceInstances,
      eq(schema.bindings.serviceInstanceId, schema.serviceInstances.id),
    )
    .innerJoin(
      schema.serviceTemplates,
      eq(schema.serviceInstances.templateId, schema.serviceTemplates.id),
    )
    .where(eq(schema.bindings.applicationId, applicationId));
  if (boundServices.length === 0) return {};

  const credentialRows = await getDb()
    .select()
    .from(schema.serviceCredentials)
    .where(
      inArray(
        schema.serviceCredentials.serviceInstanceId,
        boundServices.map((service) => service.serviceInstanceId),
      ),
  );
  const credentialsByService = new Map<string, ServiceCredentials>();
  const decryptedRows = await Promise.all(
    credentialRows.map(async (row) => {
      return { ...row, value: await decryptCredential(row.value) };
    }),
  );
  for (const row of decryptedRows) {
    const credentials = credentialsByService.get(row.serviceInstanceId) ?? {};
    credentials[row.key] = row.value;
    credentialsByService.set(row.serviceInstanceId, credentials);
  }

  return Object.fromEntries(
    boundServices.map((service) => {
      const template = serviceCatalog.find(
        (item) => item.name === service.templateName,
      );
      if (!template) {
        throw new Error(
          `Service runtime not found for template: ${service.templateName}`,
        );
      }
      return [
        service.injectedVarKey,
        serviceConnectionString(
          template,
          serviceContainerName(service.serviceInstanceId),
          credentialsByService.get(service.serviceInstanceId) ?? {},
        ),
      ];
    }),
  );
}
