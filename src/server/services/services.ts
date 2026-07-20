import { randomUUID } from "node:crypto";

import { mockServiceInstances } from "@/lib/mock-data";
import type { ServiceInstance } from "@/lib/types";
import { getDb, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import { serviceCatalog } from "../catalog";
import { createDockerClient } from "../docker";
import { isDatabaseEnabled } from "../env";
import { encryptCredential } from "../credentials-crypto";
import { serializeDates } from "./mappers";
import {
  generateServiceCredentials,
  serviceContainerConfig,
  serviceContainerName,
} from "./service-runtime";

type CreateServiceInput = Pick<
  ServiceInstance,
  "projectId" | "environment" | "templateId" | "name" | "version"
>;
type CanvasService = ServiceInstance & {
  canvasX: number | null;
  canvasY: number | null;
};

const simulatedServices: CanvasService[] = mockServiceInstances.map((item, index) => ({
  ...item,
  canvasX: 220 + (index % 2) * 340,
  canvasY: 380 + Math.floor(index / 2) * 220,
}));

export async function listServices(): Promise<ServiceInstance[]> {
  if (!isDatabaseEnabled()) return simulatedServices;
  const rows = await getDb().select().from(schema.serviceInstances).orderBy(asc(schema.serviceInstances.createdAt));
  return Promise.all(rows.map(syncServiceStatus));
}

export async function getService(id: string): Promise<ServiceInstance | null> {
  if (!isDatabaseEnabled()) {
    return simulatedServices.find((service) => service.id === id) ?? null;
  }
  const [row] = await getDb().select().from(schema.serviceInstances).where(eq(schema.serviceInstances.id, id)).limit(1);
  return row ? syncServiceStatus(row) : null;
}

type ServiceRow = typeof schema.serviceInstances.$inferSelect;

async function syncServiceStatus(row: ServiceRow): Promise<ServiceInstance> {
  let status = row.status;
  try {
    const inspection = await createDockerClient()
      .getContainer(serviceContainerName(row.id))
      .inspect();
    status = inspection.State.Running
      ? "running"
      : inspection.State.ExitCode === 0
        ? "stopped"
        : "failed";
  } catch (error) {
    if (
      (error as { statusCode?: number }).statusCode === 404 &&
      row.status !== "failed"
    ) {
      status = "stopped";
    }
  }

  if (status !== row.status) {
    await getDb()
      .update(schema.serviceInstances)
      .set({ status })
      .where(eq(schema.serviceInstances.id, row.id));
  }
  return serializeDates<ServiceInstance>({ ...row, status });
}

export async function createService(
  input: CreateServiceInput,
): Promise<ServiceInstance> {
  if (!isDatabaseEnabled()) {
    const service: CanvasService = {
      id: randomUUID(),
      ...input,
      status: "stopped",
      canvasX: null,
      canvasY: null,
      createdAt: new Date().toISOString(),
    };
    simulatedServices.push(service);
    return service;
  }

  const catalogTemplate = serviceCatalog.find(
    (template) => template.id === input.templateId,
  );
  const templateFilter = catalogTemplate
    ? eq(schema.serviceTemplates.name, catalogTemplate.name)
    : eq(schema.serviceTemplates.id, input.templateId);
  const [template] = await getDb()
    .select({ id: schema.serviceTemplates.id, name: schema.serviceTemplates.name })
    .from(schema.serviceTemplates)
    .where(templateFilter)
    .limit(1);
  if (!template) throw new Error(`Service template not found: ${input.templateId}`);

  const runtimeTemplate =
    catalogTemplate ??
    serviceCatalog.find((item) => item.name === template.name);
  if (!runtimeTemplate) {
    throw new Error(`Service runtime not found for template: ${template.name}`);
  }

  const serviceInstanceId = randomUUID();
  const credentials = generateServiceCredentials(runtimeTemplate);
  const encryptedCredentials = await Promise.all(
    Object.entries(credentials).map(async ([key, value]) => ({
      serviceInstanceId,
      key,
      value: await encryptCredential(value),
    })),
  );
  const row = await getDb().transaction(async (transaction) => {
    const [created] = await transaction
      .insert(schema.serviceInstances)
      .values({
        ...input,
        id: serviceInstanceId,
        templateId: template.id,
        status: "stopped",
      })
      .returning();
    await transaction
      .insert(schema.serviceCredentials)
      .values(encryptedCredentials);
    return created;
  });

  const docker = createDockerClient();
  const containerName = serviceContainerName(row.id);
  let container: ReturnType<typeof docker.getContainer> | undefined;
  try {
    const stream = await docker.pull(runtimeTemplate.dockerImage);
    await new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(stream, (error) =>
        error ? reject(error) : resolve(),
      );
    });
    container = await docker.createContainer({
      name: containerName,
      Image: runtimeTemplate.dockerImage,
      ...serviceContainerConfig(runtimeTemplate, credentials),
      Labels: {
        "olym.managed": "true",
        "olym.service-instance-id": row.id,
      },
      HostConfig: {
        NetworkMode: process.env.OLYM_DOCKER_NETWORK?.trim() || "olym",
        RestartPolicy: { Name: "unless-stopped" },
      },
    });
    await container.start();
    const [running] = await getDb()
      .update(schema.serviceInstances)
      .set({ status: "running" })
      .where(eq(schema.serviceInstances.id, row.id))
      .returning();
    return serializeDates<ServiceInstance>(running);
  } catch (error) {
    await getDb()
      .update(schema.serviceInstances)
      .set({ status: "failed" })
      .where(eq(schema.serviceInstances.id, row.id));
    if (container) await container.remove({ force: true }).catch(() => undefined);
    throw error;
  }
}

export async function updateServicePosition(
  id: string,
  position: { x: number; y: number },
): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    const service = simulatedServices.find((item) => item.id === id);
    if (!service) return false;
    service.canvasX = position.x;
    service.canvasY = position.y;
    return true;
  }
  const rows = await getDb()
    .update(schema.serviceInstances)
    .set({ canvasX: position.x, canvasY: position.y })
    .where(eq(schema.serviceInstances.id, id))
    .returning({ id: schema.serviceInstances.id });
  return rows.length > 0;
}
