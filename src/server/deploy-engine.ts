import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Docker from "dockerode";
import { simpleGit } from "simple-git";
import { redactSecrets } from "./redaction";

export interface BuildApplication {
  id: string;
  repoUrl: string | null;
  branch: string;
}

export interface BuildResult {
  imageTag: string;
  commitSha: string;
}

export interface ImageApplication {
  dockerImage: string;
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
  healthCheckPath?: string | null;
}

export type BuildLogWriter = (
  stream: "stdout" | "stderr" | "system",
  message: string,
) => Promise<void>;

export class DeploymentReadinessError extends Error {
  readonly previousContainerKept: boolean;

  constructor(message: string, previousContainerKept: boolean) {
    super(message);
    this.name = "DeploymentReadinessError";
    this.previousContainerKept = previousContainerKept;
  }
}

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function positiveIntegerFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

async function waitForContainerReadiness(
  container: Docker.Container,
  port: number,
  applicationPath?: string | null,
): Promise<void> {
  const timeoutMs = positiveIntegerFromEnv("DEPLOY_READINESS_TIMEOUT_MS", 60_000);
  const intervalMs = positiveIntegerFromEnv("DEPLOY_READINESS_INTERVAL_MS", 1_000);
  const pathName =
    applicationPath?.trim() ||
    process.env.DEPLOY_READINESS_PATH?.trim() ||
    "/";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const inspection = await container.inspect();
    if (!inspection.State.Running) {
      throw new Error(`Container exited with code ${inspection.State.ExitCode}`);
    }

    if (inspection.Config.Healthcheck?.Test?.length) {
      const health = inspection.State.Health?.Status;
      if (health === "healthy") return;
      if (health === "unhealthy") throw new Error("Container healthcheck is unhealthy");
    } else {
      const address = Object.values(inspection.NetworkSettings.Networks)[0]?.IPAddress;
      if (address) {
        try {
          const response = await fetch(`http://${address}:${port}${pathName}`, {
            signal: AbortSignal.timeout(Math.min(intervalMs, 5_000)),
          });
          if (response.ok) return;
        } catch {
          // The application may still be booting; retry until the deadline.
        }
      }
    }
    await delay(Math.min(intervalMs, Math.max(1, deadline - Date.now())));
  }

  throw new Error(`Container readiness timed out after ${timeoutMs}ms`);
}

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
        if (message) {
          void writeLog(
            event.error ? "stderr" : "stdout",
            redactSecrets(message),
          );
        }
      },
    );
  });
}

export async function cloneAndBuildApplication(
  deploymentId: string,
  application: BuildApplication,
  writeLog: BuildLogWriter,
): Promise<BuildResult> {
  if (!application.repoUrl) {
    throw new Error("Git deployment requires a repository URL");
  }
  const workspace = await mkdtemp(path.join(tmpdir(), "olym-build-"));
  const repositoryPath = path.join(workspace, "repository");
  const imageTag = `olym/app-${application.id}:deployment-${deploymentId}`;

  try {
    await writeLog(
      "system",
      redactSecrets(`Cloning ${application.repoUrl} (${application.branch})`),
    );
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

export async function pullImageForApplication(
  application: ImageApplication,
  writeLog: BuildLogWriter,
): Promise<BuildResult> {
  const docker = createDockerClient();
  const imageTag = application.dockerImage.trim();
  if (!imageTag) throw new Error("Docker image deployment requires an image");

  await writeLog("system", `Pulling Docker image ${redactSecrets(imageTag)}`);
  const stream = await docker.pull(imageTag);
  await followBuild(docker, stream, writeLog);
  const inspection = await docker.getImage(imageTag).inspect();
  const imageId = inspection.Id.replace(/^sha256:/, "");
  await writeLog("system", `Docker image ready at ${imageId.slice(0, 12)}`);
  return { imageTag, commitSha: imageId.slice(0, 40) };
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
  try {
    await waitForContainerReadiness(
      container,
      application.port,
      options.healthCheckPath,
    );
  } catch (error) {
    await container.stop({ t: 5 }).catch(() => undefined);
    await container.remove({ force: true }).catch(() => undefined);
    throw new DeploymentReadinessError(
      error instanceof Error ? error.message : "Container readiness failed",
      previousContainers.some(({ State }) => State === "running"),
    );
  }
  await Promise.all(
    previousContainers.map(async ({ Id, State }) => {
      const previous = docker.getContainer(Id);
      if (State === "running") await previous.stop({ t: 10 });
      await previous.remove();
    }),
  );
  return container.id;
}
