import { mockServiceInstances } from "@/lib/mock-data";
import type { ServiceInstance } from "@/lib/types";

export async function listServices(): Promise<ServiceInstance[]> {
  return mockServiceInstances;
}

export async function getService(id: string): Promise<ServiceInstance | null> {
  return mockServiceInstances.find((service) => service.id === id) ?? null;
}
