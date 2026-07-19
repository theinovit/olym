// Project service — F1 stubs. Real Drizzle queries land in F2 (use getDb()).

import type { Project } from "@/lib/types";
import { mockProjects } from "@/lib/mock-data";
import { NotImplementedError } from "../errors";

export async function listProjects(): Promise<Project[]> {
  return mockProjects;
}

export async function getProject(id: string): Promise<Project | null> {
  return mockProjects.find((project) => project.id === id) ?? null;
}

export async function createProject(
  input: Pick<Project, "name" | "slug" | "serverId"> &
    Partial<Pick<Project, "description">>,
): Promise<Project> {
  void input;
  throw new NotImplementedError("projects.createProject");
}

export async function deleteProject(id: string): Promise<void> {
  void id;
  throw new NotImplementedError("projects.deleteProject");
}
