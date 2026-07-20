// Deployment service — F1 stubs. The real deploy engine (BullMQ worker,
// git clone → build → run → Traefik) lands in F2.

import { randomUUID } from "node:crypto";

import type { Application, Deployment, LogLine } from "@/lib/types";
import { mockDeployments } from "@/lib/mock-data";
import { getDb, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import { isDatabaseEnabled } from "../env";
import { NotImplementedError } from "../errors";
import { serializeDates } from "./mappers";

type DeploymentListener = (line: LogLine, deployment: Deployment) => void;

interface SimulatedDeploymentStore {
  deployments: Map<string, Deployment>;
  logs: Map<string, LogLine[]>;
  listeners: Map<string, Set<DeploymentListener>>;
  timers: Map<string, Set<NodeJS.Timeout>>;
  createdCount: number;
}

const globalStore = globalThis as typeof globalThis & {
  __hefestoDeployments?: SimulatedDeploymentStore;
};

const simulatedStore = (globalStore.__hefestoDeployments ??= {
  deployments: new Map(),
  logs: new Map(),
  listeners: new Map(),
  timers: new Map(),
  createdCount: 0,
});

// Stores created before this field was introduced survive Fast Refresh.
simulatedStore.timers ??= new Map();

const terminalStatuses = new Set<Deployment["status"]>([
  "running",
  "failed",
  "cancelled",
]);

function clearDeploymentTimers(id: string) {
  for (const timer of simulatedStore.timers.get(id) ?? []) clearTimeout(timer);
  simulatedStore.timers.delete(id);
}

function scheduleDeploymentStep(
  deployment: Deployment,
  delay: number,
  step: () => void,
) {
  const timer = setTimeout(() => {
    const timers = simulatedStore.timers.get(deployment.id);
    timers?.delete(timer);
    if (!timers?.size) simulatedStore.timers.delete(deployment.id);
    if (terminalStatuses.has(deployment.status)) return;
    step();
  }, delay);
  timer.unref();
  const timers = simulatedStore.timers.get(deployment.id) ?? new Set();
  timers.add(timer);
  simulatedStore.timers.set(deployment.id, timers);
}

function addLog(
  deployment: Deployment,
  stream: LogLine["stream"],
  message: string,
) {
  const line: LogLine = {
    timestamp: new Date().toISOString(),
    stream,
    message: `[${deployment.id}] ${message}`,
  };
  const logs = simulatedStore.logs.get(deployment.id) ?? [];
  logs.push(line);
  simulatedStore.logs.set(deployment.id, logs);
  for (const listener of simulatedStore.listeners.get(deployment.id) ?? []) {
    listener(line, deployment);
  }
}

function finishDeployment(deployment: Deployment, status: "running" | "failed") {
  clearDeploymentTimers(deployment.id);
  deployment.status = status;
  deployment.finishedAt = new Date().toISOString();
  deployment.durationSec = Math.max(
    1,
    Math.round(
      (Date.parse(deployment.finishedAt) - Date.parse(deployment.startedAt)) /
        1000,
    ),
  );
  addLog(
    deployment,
    status === "failed" ? "stderr" : "system",
    status === "failed"
      ? "Build failed during simulated compilation"
      : "Deployment is running",
  );
}

export function createSimulatedDeployment(
  id: string,
  application: Application,
): Deployment {
  simulatedStore.createdCount += 1;
  const shouldFail = simulatedStore.createdCount % 5 === 0;
  const deployment: Deployment = {
    id,
    applicationId: application.id,
    status: "queued",
    commitSha: randomUUID().replaceAll("-", "").slice(0, 7),
    commitMessage: `chore: simulated deployment #${simulatedStore.createdCount}`,
    branch: application.branch,
    triggeredBy: "dashboard",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationSec: null,
  };
  simulatedStore.deployments.set(id, deployment);
  simulatedStore.logs.set(id, []);
  addLog(deployment, "system", "Deployment accepted and queued");

  scheduleDeploymentStep(deployment, 3_000, () => {
    deployment.status = "building";
    addLog(deployment, "stdout", "Building application artifact");
  });

  scheduleDeploymentStep(deployment, 8_000, () => {
    if (shouldFail) {
      finishDeployment(deployment, "failed");
      return;
    }
    deployment.status = "deploying";
    addLog(deployment, "stdout", "Build complete; starting deployment");
  });

  if (!shouldFail) {
    scheduleDeploymentStep(deployment, 11_000, () =>
      finishDeployment(deployment, "running"),
    );
  }

  return deployment;
}

export function isSimulatedDeployment(id: string): boolean {
  return simulatedStore.deployments.has(id);
}

export function subscribeToDeployment(
  id: string,
  listener: DeploymentListener,
): (() => void) | null {
  if (!simulatedStore.deployments.has(id)) return null;
  const listeners = simulatedStore.listeners.get(id) ?? new Set();
  listeners.add(listener);
  simulatedStore.listeners.set(id, listeners);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) simulatedStore.listeners.delete(id);
  };
}

export async function listDeployments(
  applicationId?: string,
): Promise<Deployment[]> {
  if (!isDatabaseEnabled()) {
    const deployments = [
      ...simulatedStore.deployments.values(),
      ...mockDeployments,
    ].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    return applicationId
    ? deployments.filter(
        (deployment) => deployment.applicationId === applicationId,
      )
    : deployments;
  }
  const query = getDb().select().from(schema.deployments);
  const rows = applicationId
    ? await query.where(eq(schema.deployments.applicationId, applicationId)).orderBy(desc(schema.deployments.startedAt))
    : await query.orderBy(desc(schema.deployments.startedAt));
  return rows.map((row) => serializeDates<Deployment>(row));
}

export async function getDeployment(id: string): Promise<Deployment | null> {
  if (!isDatabaseEnabled()) {
    return simulatedStore.deployments.get(id) ??
      mockDeployments.find((deployment) => deployment.id === id) ??
      null;
  }
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
  if (!isDatabaseEnabled()) {
    const deployment = simulatedStore.deployments.get(id);
    if (!deployment || terminalStatuses.has(deployment.status)) return;
    clearDeploymentTimers(id);
    deployment.status = "cancelled";
    deployment.finishedAt = new Date().toISOString();
    deployment.durationSec = Math.max(
      0,
      Math.round(
        (Date.parse(deployment.finishedAt) - Date.parse(deployment.startedAt)) /
          1000,
      ),
    );
    addLog(deployment, "system", "Deployment cancelled");
    return;
  }
  await getDb().update(schema.deployments).set({
    status: "cancelled",
    finishedAt: new Date(),
  }).where(eq(schema.deployments.id, id));
}

export async function getDeploymentLogs(id: string): Promise<LogLine[]> {
  return [...(simulatedStore.logs.get(id) ?? [])];
}

type HotModule = NodeModule & {
  hot?: { dispose(callback: () => void): void };
};

const hot =
  typeof module !== "undefined" ? (module as HotModule).hot : undefined;
hot?.dispose(() => {
  for (const id of simulatedStore.timers.keys()) clearDeploymentTimers(id);
  for (const deployment of simulatedStore.deployments.values()) {
    if (terminalStatuses.has(deployment.status)) continue;
    deployment.status = "cancelled";
    deployment.finishedAt = new Date().toISOString();
    deployment.durationSec = Math.max(
      0,
      Math.round(
        (Date.parse(deployment.finishedAt) - Date.parse(deployment.startedAt)) /
          1000,
      ),
    );
    addLog(deployment, "system", "Deployment cancelled during server reload");
  }
});
