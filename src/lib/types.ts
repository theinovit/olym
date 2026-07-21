// Olym domain types — the contract between Frontend and Backend.
// Owned by the CEO; changes must be coordinated.

export type EnvironmentName = "production" | "staging" | "development";

export type DeploymentStatus =
  | "queued"
  | "building"
  | "deploying"
  | "running"
  | "failed"
  | "cancelled";

export type AppStatus = "running" | "stopped" | "building" | "failed";

export type ServerStatus = "online" | "offline" | "provisioning";

export type Framework =
  | "nextjs"
  | "nuxt"
  | "sveltekit"
  | "remix"
  | "adonisjs"
  | "express"
  | "fastify"
  | "nestjs"
  | "django"
  | "rails"
  | "laravel"
  | "symfony"
  | "blazor"
  | "phoenix"
  | "static"
  | "other";

export type FrameworkCategory = "frontend" | "backend" | "fullstack" | "static";

export interface Server {
  id: string;
  name: string;
  host: string;
  status: ServerStatus;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  cpuUsagePct: number;
  memoryUsagePct: number;
  diskUsagePct: number;
  dockerVersion: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  serverId: string;
  createdAt: string;
}

export interface Application {
  id: string;
  projectId: string;
  environment: EnvironmentName;
  name: string;
  framework: Framework;
  repoUrl: string | null;
  dockerImage?: string | null;
  branch: string;
  buildCommand: string | null;
  installCommand: string | null;
  startCommand: string | null;
  outputDirectory: string | null;
  healthCheckPath?: string | null;
  port: number;
  status: AppStatus;
  createdAt: string;
}

export interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  category: "database" | "cache" | "storage" | "search" | "queue" | "analytics";
  defaultVersion: string;
}

export interface ServiceInstance {
  id: string;
  projectId: string;
  environment: EnvironmentName;
  templateId: string;
  templateName: string;
  name: string;
  version: string;
  status: AppStatus;
  createdAt: string;
}

export interface Deployment {
  id: string;
  applicationId: string;
  status: DeploymentStatus;
  commitSha: string;
  commitMessage: string;
  branch: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  durationSec: number | null;
}

export interface Domain {
  id: string;
  applicationId: string;
  hostname: string;
  isPrimary: boolean;
  sslStatus: "active" | "pending" | "failed";
  createdAt: string;
}

export interface EnvVar {
  id: string;
  applicationId: string;
  environment: EnvironmentName;
  key: string;
  // value is never sent to the client in full; masked server-side
  maskedValue: string;
  createdAt: string;
}

// A Binding wires an application to a service inside the project canvas
// (Railway-style): connecting injects the service credentials into the app.
export interface Binding {
  id: string;
  applicationId: string;
  serviceInstanceId: string;
  // env var injected into the application, e.g. DATABASE_URL, REDIS_URL
  injectedVarKey: string;
  createdAt: string;
}

export interface LogLine {
  timestamp: string;
  stream: "stdout" | "stderr" | "system";
  message: string;
}
