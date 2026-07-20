import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";

import { serviceCatalog } from "../catalog";
import { decryptCredential } from "../credentials-crypto";
import {
  serviceConnectionString,
  serviceContainerName,
  type ServiceCredentials,
} from "./service-runtime";

export async function getServiceConnection(
  serviceInstanceId: string,
): Promise<string | null> {
  const [service] = await getDb()
    .select({ templateName: schema.serviceTemplates.name })
    .from(schema.serviceInstances)
    .innerJoin(
      schema.serviceTemplates,
      eq(schema.serviceInstances.templateId, schema.serviceTemplates.id),
    )
    .where(eq(schema.serviceInstances.id, serviceInstanceId))
    .limit(1);
  if (!service) return null;

  const template = serviceCatalog.find(
    (item) => item.name === service.templateName,
  );
  if (!template) {
    throw new Error(
      `Service runtime not found for template: ${service.templateName}`,
    );
  }

  const credentialRows = await getDb()
    .select({ key: schema.serviceCredentials.key, value: schema.serviceCredentials.value })
    .from(schema.serviceCredentials)
    .where(
      eq(schema.serviceCredentials.serviceInstanceId, serviceInstanceId),
    );
  const credentials: ServiceCredentials = Object.fromEntries(
    await Promise.all(
      credentialRows.map(async (row) => [
        row.key,
        await decryptCredential(row.value),
      ]),
    ),
  );

  return serviceConnectionString(
    template,
    serviceContainerName(serviceInstanceId),
    credentials,
  );
}
