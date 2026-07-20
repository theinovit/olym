import Docker from "dockerode";

export function createDockerClient(): Docker {
  const dockerHost = process.env.DOCKER_HOST?.trim();
  if (!dockerHost) return new Docker({ socketPath: "/var/run/docker.sock" });
  if (dockerHost.startsWith("unix://")) {
    return new Docker({ socketPath: dockerHost.slice("unix://".length) });
  }

  const endpoint = new URL(dockerHost);
  return new Docker({
    protocol: endpoint.protocol.replace(":", "") as "http" | "https",
    host: endpoint.hostname,
    port: Number(endpoint.port),
  });
}
