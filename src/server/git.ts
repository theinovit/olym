import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { BadRequestError } from "./errors";

const execFileAsync = promisify(execFile);

export interface RepositoryValidation {
  accessible: boolean;
  defaultBranch: string | null;
  branches: string[];
}

const ALLOWED_GIT_HOSTS = new Set([
  "github.com",
  "gitlab.com",
  "bitbucket.org",
]);

function validatedRepositoryUrl(repoUrl: string): URL {
  let url: URL;
  try {
    url = new URL(repoUrl);
  } catch {
    throw new BadRequestError("INVALID_REPOSITORY_URL", "Repository URL is invalid.");
  }
  if (url.protocol !== "https:") {
    throw new BadRequestError(
      "INVALID_REPOSITORY_URL",
      "Repository URL must use HTTPS.",
    );
  }
  if (url.port && url.port !== "443") {
    throw new BadRequestError(
      "INVALID_REPOSITORY_URL",
      "Repository URL must use the default HTTPS port.",
    );
  }
  if (!ALLOWED_GIT_HOSTS.has(url.hostname.toLowerCase())) {
    throw new BadRequestError(
      "INVALID_REPOSITORY_HOST",
      "Repository host is not allowed.",
    );
  }
  if (url.username || url.password) {
    throw new BadRequestError(
      "INVALID_REPOSITORY_URL",
      "Repository URL must not contain credentials.",
    );
  }
  return url;
}

export async function validateRepository(
  repoUrl: string,
  token?: string,
): Promise<RepositoryValidation> {
  const remoteUrl = validatedRepositoryUrl(repoUrl);
  const effectiveToken =
    token ||
    (remoteUrl.hostname.toLowerCase() === "github.com"
      ? process.env.GITHUB_TOKEN?.trim()
      : undefined);
  if (effectiveToken && /[\r\n]/.test(effectiveToken)) {
    throw new BadRequestError("INVALID_GIT_TOKEN", "Git token is invalid.");
  }
  const credentialHelper =
    "credential.helper=!f() { echo username=x-access-token; echo password=$OLYM_GIT_TOKEN; }; f";
  const args = effectiveToken
    ? ["-c", credentialHelper, "ls-remote", "--symref", remoteUrl.toString()]
    : ["ls-remote", "--symref", remoteUrl.toString()];
  try {
    const { stdout } = await execFileAsync(
      "git",
      args,
      {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          OLYM_GIT_TOKEN: effectiveToken ?? "",
        },
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
    // Never surface or log child-process errors, arguments, or environment.
    return { accessible: false, defaultBranch: null, branches: [] };
  }
}
