import { mockApplications } from "@/lib/mock-data";
import type { Application } from "@/lib/types";
import { getDb, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import { isDatabaseEnabled } from "../env";
import { serializeDates } from "./mappers";

type CreateApplicationInput = Omit<Application, "id" | "status" | "createdAt">;
type CanvasApplication = Application & {
  canvasX: number | null;
  canvasY: number | null;
};

const simulatedApplications: CanvasApplication[] = mockApplications.map((item, index) => ({
  ...item,
  canvasX: 80 + (index % 3) * 300,
  canvasY: 100 + Math.floor(index / 3) * 220,
}));

export async function listApplications(): Promise<Application[]> {
  if (!isDatabaseEnabled()) return simulatedApplications;
  const rows = await getDb().select().from(schema.applications).orderBy(asc(schema.applications.createdAt));
  return rows.map((row) => serializeDates<Application>(row));
}

export async function getApplication(id: string): Promise<Application | null> {
  if (!isDatabaseEnabled()) {
    return simulatedApplications.find((application) => application.id === id) ?? null;
  }
  const [row] = await getDb().select().from(schema.applications).where(eq(schema.applications.id, id)).limit(1);
  return row ? serializeDates<Application>(row) : null;
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<Application> {
  if (!isDatabaseEnabled()) {
    const application: CanvasApplication = {
      id: randomUUID(),
      ...input,
      status: "stopped",
      canvasX: null,
      canvasY: null,
      createdAt: new Date().toISOString(),
    };
    simulatedApplications.push(application);
    return application;
  }

  const [row] = await getDb()
    .insert(schema.applications)
    .values({ ...input, status: "stopped" })
    .returning();
  return serializeDates<Application>(row);
}

export async function updateApplicationPosition(
  id: string,
  position: { x: number; y: number },
): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    const application = simulatedApplications.find((item) => item.id === id);
    if (!application) return false;
    application.canvasX = position.x;
    application.canvasY = position.y;
    return true;
  }
  const rows = await getDb()
    .update(schema.applications)
    .set({ canvasX: position.x, canvasY: position.y })
    .where(eq(schema.applications.id, id))
    .returning({ id: schema.applications.id });
  return rows.length > 0;
}

export async function updateApplicationHealthCheck(
  id: string,
  healthCheckPath: string | null,
): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    const application = simulatedApplications.find((item) => item.id === id);
    if (!application) return false;
    application.healthCheckPath = healthCheckPath;
    return true;
  }
  const rows = await getDb()
    .update(schema.applications)
    .set({ healthCheckPath })
    .where(eq(schema.applications.id, id))
    .returning({ id: schema.applications.id });
  return rows.length > 0;
}
import { randomUUID } from "node:crypto";
