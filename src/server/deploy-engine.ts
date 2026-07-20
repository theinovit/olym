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

function followBuild(docker: Docker, stream: NodeJS.ReadableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function cloneAndBuildApplication(
  deploymentId: string,
  application: BuildApplication,
): Promise<BuildResult> {
  const workspace = await mkdtemp(path.join(tmpdir(), "olym-build-"));
  const repositoryPath = path.join(workspace, "repository");
  const imageTag = `olym/app-${application.id}:deployment-${deploymentId}`;

  try {
    const git = simpleGit();
    await git.clone(application.repoUrl, repositoryPath, [
      "--depth",
      "1",
      "--single-branch",
      "--branch",
      application.branch,
    ]);
    const commitSha = (await simpleGit(repositoryPath).revparse(["HEAD"])).trim();

    const docker = createDockerClient();
    const archive = await docker.buildImage(
      { context: repositoryPath, src: ["."] },
      { dockerfile: "Dockerfile", t: imageTag, rm: true },
    );
    await followBuild(docker, archive);

    return { imageTag, commitSha };
  } finally {
    // Keeping build contexts after a failed deploy leaks source code and disk.
    await rm(workspace, { recursive: true, force: true });
  }
}
