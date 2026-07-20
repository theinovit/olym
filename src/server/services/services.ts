import { mockServiceInstances } from "@/lib/mock-data";
import type { ServiceInstance } from "@/lib/types";
import { getDb, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import { serviceCatalog } from "../catalog";
import { isDatabaseEnabled } from "../env";
import { serializeDates } from "./mappers";

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
  return rows.map((row) => serializeDates<ServiceInstance>(row));
}

export async function getService(id: string): Promise<ServiceInstance | null> {
  if (!isDatabaseEnabled()) {
    return simulatedServices.find((service) => service.id === id) ?? null;
  }
  const [row] = await getDb().select().from(schema.serviceInstances).where(eq(schema.serviceInstances.id, id)).limit(1);
  return row ? serializeDates<ServiceInstance>(row) : null;
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
    .select({ id: schema.serviceTemplates.id })
    .from(schema.serviceTemplates)
    .where(templateFilter)
    .limit(1);
  if (!template) throw new Error(`Service template not found: ${input.templateId}`);

  const [row] = await getDb()
    .insert(schema.serviceInstances)
    .values({ ...input, templateId: template.id, status: "stopped" })
    .returning();
  return serializeDates<ServiceInstance>(row);
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
import { randomUUID } from "node:crypto";
