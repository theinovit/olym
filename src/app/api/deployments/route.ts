import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { DeploymentStatus } from "@/lib/types";
import { dataResponse, errorResponse } from "@/server/http";
import { isDatabaseEnabled } from "@/server/env";
import { enqueueDeployment } from "@/server/queue";
import { getApplication } from "@/server/services/applications";
import {
  createSimulatedDeployment,
  listDeployments,
  triggerDeployment,
} from "@/server/services/deployments";

const deploymentStatuses = new Set<DeploymentStatus>([
  "queued",
  "building",
  "deploying",
  "running",
  "failed",
  "cancelled",
]);

const createDeploymentSchema = z.object({
  applicationId: z.string().trim().min(1),
});

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

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = createDeploymentSchema.safeParse(body);
  if (!result.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Invalid request body.",
    );
  }

  const application = await getApplication(result.data.applicationId);
  if (!application) {
    return errorResponse(
      404,
      "APPLICATION_NOT_FOUND",
      "Application not found.",
    );
  }

  const deployment = isDatabaseEnabled()
    ? await triggerDeployment(application.id)
    : createSimulatedDeployment(randomUUID(), application);

  const mode = await enqueueDeployment({
    deploymentId: deployment.id,
    applicationId: result.data.applicationId,
  });

  return dataResponse(
    { deploymentId: deployment.id, status: deployment.status, mode },
    { status: 202 },
  );
}
