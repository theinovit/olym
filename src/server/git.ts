import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { BadRequestError } from "./errors";

const execFileAsync = promisify(execFile);

export interface RepositoryValidation {
  accessible: boolean;
  defaultBranch: string | null;
  branches: string[];
}

function authenticatedRepositoryUrl(repoUrl: string, token?: string): string {
  let url: URL;
  try {
    url = new URL(repoUrl);
  } catch {
    throw new BadRequestError("INVALID_REPOSITORY_URL", "Repository URL is invalid.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BadRequestError(
      "INVALID_REPOSITORY_URL",
      "Repository URL must use HTTP or HTTPS.",
    );
  }
  const effectiveToken =
    token ||
    (url.hostname.toLowerCase() === "github.com"
      ? process.env.GITHUB_TOKEN?.trim()
      : undefined);
  if (effectiveToken) {
    url.username = "x-access-token";
    url.password = effectiveToken;
  }
  return url.toString();
}

export async function validateRepository(
  repoUrl: string,
  token?: string,
): Promise<RepositoryValidation> {
  const remoteUrl = authenticatedRepositoryUrl(repoUrl, token);
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-remote", "--symref", remoteUrl, "HEAD", "refs/heads/*"],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
    );
    const branches = Array.from(
      new Set(
        stdout
          .split("\n")
          .map((line) => line.match(/\trefs\/heads\/(.+)$/)?.[1])
          .filter((branch): branch is string => Boolean(branch)),
      ),
    ).sort();
    const defaultBranch =
      stdout.match(/^ref: refs\/heads\/(.+)\tHEAD$/m)?.[1] ??
      branches[0] ??
      null;
    return { accessible: true, defaultBranch, branches };
  } catch {
    // Never surface the child-process error: it can contain the authenticated URL.
    return { accessible: false, defaultBranch: null, branches: [] };
  }
}
