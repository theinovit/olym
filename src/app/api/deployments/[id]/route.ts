import { dataResponse, errorResponse } from "@/server/http";
import {
  cancelDeployment,
  getDeployment,
} from "@/server/services/deployments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deployment = await getDeployment(id);
  if (!deployment) {
    return errorResponse(404, "DEPLOYMENT_NOT_FOUND", "Deployment not found.");
  }
  return dataResponse(deployment);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deployment = await getDeployment(id);
  if (!deployment) {
    return errorResponse(404, "DEPLOYMENT_NOT_FOUND", "Deployment not found.");
  }
  await cancelDeployment(id);
  return dataResponse((await getDeployment(id)) ?? deployment);
}
