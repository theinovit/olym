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
