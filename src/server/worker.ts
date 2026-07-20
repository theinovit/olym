import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";

import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import {
  cloneAndBuildApplication,
  DeploymentReadinessError,
  pullImageForApplication,
  startApplicationContainer,
} from "./deploy-engine";
import { publishDeploymentEvent } from "./deployment-events";
import { redactSecrets } from "./redaction";

interface DeploymentJobData {
  deploymentId: string;
  applicationId: string;
}

async function processDeployment(job: Job<DeploymentJobData>) {
  const eventRedis = new IORedis(
    process.env.REDIS_URL ?? "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );
  const writeLog = async (
    stream: "stdout" | "stderr" | "system",
    message: string,
  ) => {
    const safeMessage = redactSecrets(message);
    await job.log(safeMessage);
    await publishDeploymentEvent(eventRedis, job.data.deploymentId, {
      line: { timestamp: new Date().toISOString(), stream, message: safeMessage },
    });
  };
  try {
    await writeLog("system", `Deployment ${job.data.deploymentId} queued`);
    const [application] = await getDb()
      .select({
        id: schema.applications.id,
        repoUrl: schema.applications.repoUrl,
        dockerImage: schema.applications.dockerImage,
        branch: schema.applications.branch,
        environment: schema.applications.environment,
        healthCheckPath: schema.applications.healthCheckPath,
        port: schema.applications.port,
      })
      .from(schema.applications)
      .where(eq(schema.applications.id, job.data.applicationId))
      .limit(1);
    if (!application) {
      throw new Error(`Application not found: ${job.data.applicationId}`);
    }

    await getDb()
      .update(schema.deployments)
      .set({ status: "building" })
      .where(eq(schema.deployments.id, job.data.deploymentId));
    await job.updateProgress({
      stage: application.dockerImage ? "pull" : "clone",
      percent: 10,
    });

    const result = application.dockerImage
      ? await pullImageForApplication(
          { dockerImage: application.dockerImage },
          writeLog,
        )
      : await cloneAndBuildApplication(
          job.data.deploymentId,
          application,
          writeLog,
        );
    await job.updateProgress({ stage: "build", percent: 75 });
    await writeLog("system", `Image ready: ${result.imageTag}`);
    await getDb()
      .update(schema.deployments)
      .set({ commitSha: result.commitSha })
      .where(eq(schema.deployments.id, job.data.deploymentId));
    await getDb()
      .update(schema.deployments)
      .set({ status: "deploying" })
      .where(eq(schema.deployments.id, job.data.deploymentId));
    await job.updateProgress({ stage: "deploy", percent: 85 });

    const [domain, envRows] = await Promise.all([
      getDb()
        .select({ hostname: schema.domains.hostname })
        .from(schema.domains)
        .where(eq(schema.domains.applicationId, application.id))
        .orderBy(desc(schema.domains.isPrimary))
        .limit(1),
      getDb()
        .select({ key: schema.envVars.key, value: schema.envVars.value })
        .from(schema.envVars)
        .where(
          and(
            eq(schema.envVars.applicationId, application.id),
            eq(schema.envVars.environment, application.environment),
          ),
        ),
    ]);
    const containerId = await startApplicationContainer(application, {
      deploymentId: job.data.deploymentId,
      imageTag: result.imageTag,
      hostname: domain[0]?.hostname,
      env: Object.fromEntries(envRows.map(({ key, value }) => [key, value])),
      healthCheckPath: application.healthCheckPath,
    });
    const finishedAt = new Date();
    const [deploymentStartedAt] = await getDb()
      .select({ startedAt: schema.deployments.startedAt })
      .from(schema.deployments)
      .where(eq(schema.deployments.id, job.data.deploymentId))
      .limit(1);
    const durationSec = deploymentStartedAt
      ? Math.max(
          0,
          Math.round(
            (finishedAt.getTime() - deploymentStartedAt.startedAt.getTime()) /
              1_000,
          ),
        )
      : null;
    await Promise.all([
      getDb()
        .update(schema.deployments)
        .set({ status: "running", finishedAt, durationSec })
        .where(eq(schema.deployments.id, job.data.deploymentId)),
      getDb()
        .update(schema.applications)
        .set({ status: "running" })
        .where(eq(schema.applications.id, application.id)),
    ]);
    await job.updateProgress({ stage: "done", percent: 100 });
    await publishDeploymentEvent(eventRedis, job.data.deploymentId, {
      line: {
        timestamp: finishedAt.toISOString(),
        stream: "system",
        message: `Container ${containerId.slice(0, 12)} is running`,
      },
      status: "running",
    });
    return { status: "running" as const, containerId, ...result };
  } catch (error) {
    await getDb()
      .update(schema.deployments)
      .set({ status: "failed", finishedAt: new Date() })
      .where(eq(schema.deployments.id, job.data.deploymentId));
    if (
      !(error instanceof DeploymentReadinessError) ||
      !error.previousContainerKept
    ) {
      await getDb()
        .update(schema.applications)
        .set({ status: "failed" })
        .where(eq(schema.applications.id, job.data.applicationId));
    }
    await publishDeploymentEvent(eventRedis, job.data.deploymentId, {
      line: {
        timestamp: new Date().toISOString(),
        stream: "stderr",
        message: redactSecrets(
          error instanceof Error ? error.message : "Deployment failed",
        ),
      },
      status: "failed",
    });
    throw error;
  } finally {
    await eventRedis.quit();
  }
}

// Connection and Worker are created only when the worker entrypoint runs —
// importing this module must never open a Redis connection.
export function startWorker() {
  const connection = new IORedis(
    process.env.REDIS_URL ?? "redis://localhost:6379",
    {
      maxRetriesPerRequest: null,
    },
  );

  const worker = new Worker<DeploymentJobData>("deployments", processDeployment, {
    connection,
  });

  worker.on("completed", (job) => {
    console.info(`Deployment job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Deployment job ${job?.id ?? "unknown"} failed`, error);
  });

  async function shutdown() {
    await worker.close();
    await connection.quit();
  }

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  return worker;
}

const isEntrypoint =
  process.argv[1]?.endsWith("worker.ts") ||
  process.argv[1]?.endsWith("worker.js") ||
  process.argv[1]?.endsWith("worker.cjs");

if (isEntrypoint) {
  startWorker();
}
