import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Docker from "dockerode";
import { simpleGit } from "simple-git";

export interface BuildApplication {
  id: string;
  repoUrl: string;
  branch: string;
}

export interface BuildResult {
  imageTag: string;
  commitSha: string;
}

export interface RuntimeApplication {
  id: string;
  port: number;
}

export interface RuntimeOptions {
  deploymentId: string;
  imageTag: string;
  hostname?: string;
  env: Record<string, string>;
}

export type BuildLogWriter = (
  stream: "stdout" | "stderr" | "system",
  message: string,
) => Promise<void>;

function createDockerClient(): Docker {
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

function followBuild(
  docker: Docker,
  stream: NodeJS.ReadableStream,
  writeLog: BuildLogWriter,
): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (error) => {
        if (error) reject(error);
        else resolve();
      },
      (event: { stream?: string; status?: string; error?: string }) => {
        const message = event.stream?.trim() ?? event.status ?? event.error;
        if (message) void writeLog(event.error ? "stderr" : "stdout", message);
      },
    );
  });
}

export async function cloneAndBuildApplication(
  deploymentId: string,
  application: BuildApplication,
  writeLog: BuildLogWriter,
): Promise<BuildResult> {
  const workspace = await mkdtemp(path.join(tmpdir(), "olym-build-"));
  const repositoryPath = path.join(workspace, "repository");
  const imageTag = `olym/app-${application.id}:deployment-${deploymentId}`;

  try {
    await writeLog("system", `Cloning ${application.repoUrl} (${application.branch})`);
    const git = simpleGit();
    await git.clone(application.repoUrl, repositoryPath, [
      "--depth",
      "1",
      "--single-branch",
      "--branch",
      application.branch,
    ]);
    const commitSha = (await simpleGit(repositoryPath).revparse(["HEAD"])).trim();
    await writeLog("system", `Repository cloned at ${commitSha}`);

    const docker = createDockerClient();
    await writeLog("system", `Building Docker image ${imageTag}`);
    const archive = await docker.buildImage(
      { context: repositoryPath, src: ["."] },
      { dockerfile: "Dockerfile", t: imageTag, rm: true },
    );
    await followBuild(docker, archive, writeLog);

    return { imageTag, commitSha };
  } finally {
    // Keeping build contexts after a failed deploy leaks source code and disk.
    await rm(workspace, { recursive: true, force: true });
  }
}

export async function startApplicationContainer(
  application: RuntimeApplication,
  options: RuntimeOptions,
): Promise<string> {
  const docker = createDockerClient();
  const router = `olym-${application.id.replaceAll("-", "")}`;
  const labels: Record<string, string> = {
    "olym.managed": "true",
    "olym.application-id": application.id,
    "olym.deployment-id": options.deploymentId,
    "traefik.enable": options.hostname ? "true" : "false",
  };

  if (options.hostname) {
    labels[`traefik.http.routers.${router}.rule`] = `Host(\`${options.hostname}\`)`;
    labels[`traefik.http.routers.${router}.entrypoints`] = "websecure";
    labels[`traefik.http.routers.${router}.tls.certresolver`] =
      process.env.TRAEFIK_CERTRESOLVER?.trim() || "letsencrypt";
    labels[`traefik.http.services.${router}.loadbalancer.server.port`] =
      String(application.port);
  }

  const port = `${application.port}/tcp`;
  const previousContainers = await docker.listContainers({
    all: true,
    filters: { label: [`olym.application-id=${application.id}`] },
  });
  const container = await docker.createContainer({
    name: `olym-${application.id}-${options.deploymentId}`,
    Image: options.imageTag,
    Env: Object.entries(options.env).map(([key, value]) => `${key}=${value}`),
    ExposedPorts: { [port]: {} },
    Labels: labels,
    HostConfig: {
      NetworkMode: process.env.OLYM_DOCKER_NETWORK?.trim() || "olym",
      RestartPolicy: { Name: "unless-stopped" },
    },
  });
  await container.start();
  await Promise.all(
    previousContainers.map(async ({ Id, State }) => {
      const previous = docker.getContainer(Id);
      if (State === "running") await previous.stop({ t: 10 });
      await previous.remove();
    }),
  );
  return container.id;
}
