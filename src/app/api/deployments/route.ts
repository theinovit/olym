import type { DeploymentStatus } from "@/lib/types";
import { dataResponse, errorResponse } from "@/server/http";
import { listDeployments } from "@/server/services/deployments";

const deploymentStatuses = new Set<DeploymentStatus>([
  "queued",
  "building",
  "deploying",
  "running",
  "failed",
  "cancelled",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("appId") ?? undefined;
  const status = searchParams.get("status");

  if (status && !deploymentStatuses.has(status as DeploymentStatus)) {
    return errorResponse(
      400,
      "INVALID_STATUS",
      "Status is not a valid deployment status.",
    );
  }

  const deployments = await listDeployments(applicationId);
  return dataResponse(
    status
      ? deployments.filter((deployment) => deployment.status === status)
      : deployments,
  );
}
