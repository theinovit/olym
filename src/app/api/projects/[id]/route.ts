import { dataResponse, errorResponse } from "@/server/http";
import { getProject } from "@/server/services/projects";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return errorResponse(404, "PROJECT_NOT_FOUND", "Project not found.");
  }

  return dataResponse(project);
}
