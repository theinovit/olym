// Project service — F1 stubs. Real Drizzle queries land in F2 (use getDb()).

import type { Project } from "@/lib/types";
import { mockProjects } from "@/lib/mock-data";
import { getDb, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import { isDatabaseEnabled } from "../env";
import { NotImplementedError } from "../errors";
import { serializeDates } from "./mappers";

export async function listProjects(): Promise<Project[]> {
  if (!isDatabaseEnabled()) return mockProjects;
  const rows = await getDb().select().from(schema.projects).orderBy(asc(schema.projects.createdAt));
  return rows.map((row) => serializeDates<Project>(row));
}

export async function getProject(id: string): Promise<Project | null> {
  if (!isDatabaseEnabled()) return mockProjects.find((project) => project.id === id) ?? null;
  const [row] = await getDb().select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  return row ? serializeDates<Project>(row) : null;
}

export async function createProject(
  input: Pick<Project, "name" | "slug" | "serverId"> &
    Partial<Pick<Project, "description">>,
): Promise<Project> {
  if (!isDatabaseEnabled()) throw new NotImplementedError("projects.createProject");
  const [row] = await getDb().insert(schema.projects).values({
    name: input.name,
    slug: input.slug,
    serverId: input.serverId,
    description: input.description ?? null,
  }).returning();
  return serializeDates<Project>(row);
}

export async function deleteProject(id: string): Promise<void> {
  if (!isDatabaseEnabled()) throw new NotImplementedError("projects.deleteProject");
  await getDb().delete(schema.projects).where(eq(schema.projects.id, id));
}
