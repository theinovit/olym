// Deployment service — F1 stubs. The real deploy engine (BullMQ worker,
// git clone → build → run → Traefik) lands in F2.

import type { Deployment, LogLine } from "@/lib/types";
import { mockDeployments } from "@/lib/mock-data";
import { getDb, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import { isDatabaseEnabled } from "../env";
import { NotImplementedError } from "../errors";
import { serializeDates } from "./mappers";

export async function listDeployments(
  applicationId?: string,
): Promise<Deployment[]> {
  if (!isDatabaseEnabled()) return applicationId
    ? mockDeployments.filter(
        (deployment) => deployment.applicationId === applicationId,
      )
    : mockDeployments;
  const query = getDb().select().from(schema.deployments);
  const rows = applicationId
    ? await query.where(eq(schema.deployments.applicationId, applicationId)).orderBy(desc(schema.deployments.startedAt))
    : await query.orderBy(desc(schema.deployments.startedAt));
  return rows.map((row) => serializeDates<Deployment>(row));
}

export async function getDeployment(id: string): Promise<Deployment | null> {
  if (!isDatabaseEnabled()) return mockDeployments.find((deployment) => deployment.id === id) ?? null;
  const [row] = await getDb().select().from(schema.deployments).where(eq(schema.deployments.id, id)).limit(1);
  return row ? serializeDates<Deployment>(row) : null;
}

export async function triggerDeployment(
  applicationId: string,
): Promise<Deployment> {
  if (!isDatabaseEnabled()) throw new NotImplementedError("deployments.triggerDeployment");
  const [application] = await getDb().select({ branch: schema.applications.branch }).from(schema.applications).where(eq(schema.applications.id, applicationId)).limit(1);
  if (!application) throw new Error(`Application not found: ${applicationId}`);
  const [row] = await getDb().insert(schema.deployments).values({
    applicationId,
    status: "queued",
    commitSha: "pending",
    commitMessage: "Manual deployment",
    branch: application.branch,
    triggeredBy: "manual",
  }).returning();
  return serializeDates<Deployment>(row);
}

export async function cancelDeployment(id: string): Promise<void> {
  if (!isDatabaseEnabled()) throw new NotImplementedError("deployments.cancelDeployment");
  await getDb().update(schema.deployments).set({
    status: "cancelled",
    finishedAt: new Date(),
  }).where(eq(schema.deployments.id, id));
}

export async function getDeploymentLogs(id: string): Promise<LogLine[]> {
  void id;
  return [];
}
