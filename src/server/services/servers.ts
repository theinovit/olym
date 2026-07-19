// Server service — F1 stubs. localhost via Docker socket in F2; SSH later.

import type { Server } from "@/lib/types";
import { NotImplementedError } from "../errors";

export async function listServers(): Promise<Server[]> {
  return [];
}

export async function getServer(id: string): Promise<Server | null> {
  void id;
  return null;
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
