import { mockApplications } from "@/lib/mock-data";
import type { Application } from "@/lib/types";

export async function listApplications(): Promise<Application[]> {
  return mockApplications;
}

export async function getApplication(id: string): Promise<Application | null> {
  return mockApplications.find((application) => application.id === id) ?? null;
}
