// Server service — F1 stubs. localhost via Docker socket in F2; SSH later.

import type { Server } from "@/lib/types";
import { mockServers } from "@/lib/mock-data";
import { NotImplementedError } from "../errors";

export async function listServers(): Promise<Server[]> {
  return mockServers;
}

export async function getServer(id: string): Promise<Server | null> {
  return mockServers.find((server) => server.id === id) ?? null;
}

export async function addServer(
  input: Pick<Server, "name" | "host">,
): Promise<Server> {
  void input;
  throw new NotImplementedError("servers.addServer");
}

export async function removeServer(id: string): Promise<void> {
  void id;
  throw new NotImplementedError("servers.removeServer");
}
