import { createHash } from "node:crypto";

import { getDb, schema } from "../src/db";
import {
  mockApplications,
  mockBindings,
  mockDeployments,
  mockDomains,
  mockProjects,
  mockServers,
  mockServiceInstances,
  mockServiceTemplates,
} from "../src/lib/mock-data";
import { serviceCatalog } from "../src/server/catalog";

function deterministicUuid(id: string): string {
  const bytes = Buffer.from(createHash("sha256").update(`olym:${id}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const uuid = (id: string) => deterministicUuid(id);
const date = (value: string) => new Date(value);

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }

  const db = getDb();

  await db.transaction(async (tx) => {
    for (const server of mockServers) {
      await tx.insert(schema.servers).values({ ...server, id: uuid(server.id), createdAt: date(server.createdAt) }).onConflictDoUpdate({
        target: schema.servers.id,
        set: { name: server.name, host: server.host, status: server.status, cpuCores: server.cpuCores, memoryMb: server.memoryMb, diskGb: server.diskGb, cpuUsagePct: server.cpuUsagePct, memoryUsagePct: server.memoryUsagePct, diskUsagePct: server.diskUsagePct, dockerVersion: server.dockerVersion, createdAt: date(server.createdAt) },
      });
    }

    for (const project of mockProjects) {
      await tx.insert(schema.projects).values({ ...project, id: uuid(project.id), serverId: uuid(project.serverId), createdAt: date(project.createdAt) }).onConflictDoUpdate({
        target: schema.projects.id,
        set: { name: project.name, slug: project.slug, description: project.description, serverId: uuid(project.serverId), createdAt: date(project.createdAt) },
      });
    }

    for (const [index, application] of mockApplications.entries()) {
      const canvasX = 80 + (index % 3) * 300;
      const canvasY = 100 + Math.floor(index / 3) * 220;
      await tx.insert(schema.applications).values({ ...application, id: uuid(application.id), projectId: uuid(application.projectId), canvasX, canvasY, createdAt: date(application.createdAt) }).onConflictDoUpdate({
        target: schema.applications.id,
        set: { projectId: uuid(application.projectId), environment: application.environment, name: application.name, framework: application.framework, repoUrl: application.repoUrl, branch: application.branch, buildCommand: application.buildCommand, installCommand: application.installCommand, startCommand: application.startCommand, outputDirectory: application.outputDirectory, port: application.port, status: application.status, canvasX, canvasY, createdAt: date(application.createdAt) },
      });
    }

    for (const template of mockServiceTemplates) {
      await tx.insert(schema.serviceTemplates).values({ ...template, id: uuid(template.id) }).onConflictDoUpdate({
        target: schema.serviceTemplates.id,
        set: { name: template.name, description: template.description, category: template.category, defaultVersion: template.defaultVersion },
      });
    }

    for (const template of serviceCatalog.filter(
      (catalogTemplate) =>
        !mockServiceTemplates.some(
          (mockTemplate) => mockTemplate.name === catalogTemplate.name,
        ),
    )) {
      await tx.insert(schema.serviceTemplates).values({
        id: uuid(`tpl_${template.id}`),
        name: template.name,
        description: template.description,
        category: template.category,
        defaultVersion: template.defaultVersion,
      }).onConflictDoUpdate({
        target: schema.serviceTemplates.id,
        set: { name: template.name, description: template.description, category: template.category, defaultVersion: template.defaultVersion },
      });
    }

    for (const [index, service] of mockServiceInstances.entries()) {
      const canvasX = 220 + (index % 2) * 340;
      const canvasY = 380 + Math.floor(index / 2) * 220;
      await tx.insert(schema.serviceInstances).values({ ...service, id: uuid(service.id), projectId: uuid(service.projectId), templateId: uuid(service.templateId), canvasX, canvasY, createdAt: date(service.createdAt) }).onConflictDoUpdate({
        target: schema.serviceInstances.id,
        set: { projectId: uuid(service.projectId), environment: service.environment, templateId: uuid(service.templateId), name: service.name, version: service.version, status: service.status, canvasX, canvasY, createdAt: date(service.createdAt) },
      });
    }

    for (const binding of mockBindings) {
      await tx.insert(schema.bindings).values({
        id: uuid(binding.id),
        applicationId: uuid(binding.applicationId),
        serviceInstanceId: uuid(binding.serviceInstanceId),
        injectedVarKey: binding.injectedVarKey,
        createdAt: date(binding.createdAt),
      }).onConflictDoUpdate({
        target: [schema.bindings.applicationId, schema.bindings.serviceInstanceId],
        set: {
          injectedVarKey: binding.injectedVarKey,
          createdAt: date(binding.createdAt),
        },
      });
    }

    for (const deployment of mockDeployments) {
      await tx.insert(schema.deployments).values({ ...deployment, id: uuid(deployment.id), applicationId: uuid(deployment.applicationId), startedAt: date(deployment.startedAt), finishedAt: deployment.finishedAt ? date(deployment.finishedAt) : null }).onConflictDoUpdate({
        target: schema.deployments.id,
        set: { applicationId: uuid(deployment.applicationId), status: deployment.status, commitSha: deployment.commitSha, commitMessage: deployment.commitMessage, branch: deployment.branch, triggeredBy: deployment.triggeredBy, startedAt: date(deployment.startedAt), finishedAt: deployment.finishedAt ? date(deployment.finishedAt) : null, durationSec: deployment.durationSec },
      });
    }

    for (const domain of mockDomains) {
      await tx.insert(schema.domains).values({ ...domain, id: uuid(domain.id), applicationId: uuid(domain.applicationId), createdAt: date(domain.createdAt) }).onConflictDoUpdate({
        target: schema.domains.id,
        set: { applicationId: uuid(domain.applicationId), hostname: domain.hostname, isPrimary: domain.isPrimary, sslStatus: domain.sslStatus, createdAt: date(domain.createdAt) },
      });
    }
  });

  console.info("Olym mock data seeded successfully.");
}

seed().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
