import { mockDomains } from "@/lib/mock-data";
import type { Domain } from "@/lib/types";

export async function listDomains(): Promise<Domain[]> {
  return mockDomains;
}

export async function getDomain(id: string): Promise<Domain | null> {
  return mockDomains.find((domain) => domain.id === id) ?? null;
}
