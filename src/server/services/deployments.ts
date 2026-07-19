// Deployment service — F1 stubs. The real deploy engine (BullMQ worker,
// git clone → build → run → Traefik) lands in F2.

import type { Deployment, LogLine } from "@/lib/types";
import { mockDeployments } from "@/lib/mock-data";
import { NotImplementedError } from "../errors";

export async function listDeployments(
  applicationId?: string,
): Promise<Deployment[]> {
  return applicationId
    ? mockDeployments.filter(
        (deployment) => deployment.applicationId === applicationId,
      )
    : mockDeployments;
}

export async function getDeployment(id: string): Promise<Deployment | null> {
  return mockDeployments.find((deployment) => deployment.id === id) ?? null;
}

export async function triggerDeployment(
  applicationId: string,
): Promise<Deployment> {
  void applicationId;
  throw new NotImplementedError("deployments.triggerDeployment");
}

export async function cancelDeployment(id: string): Promise<void> {
  void id;
  throw new NotImplementedError("deployments.cancelDeployment");
}

export async function getDeploymentLogs(id: string): Promise<LogLine[]> {
  void id;
  return [];
}
