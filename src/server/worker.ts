import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";

import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { cloneAndBuildApplication } from "./deploy-engine";

interface DeploymentJobData {
  deploymentId: string;
  applicationId: string;
}

async function processDeployment(job: Job<DeploymentJobData>) {
  await job.log(`Deployment ${job.data.deploymentId} queued`);
  const [application] = await getDb()
    .select({
      id: schema.applications.id,
      repoUrl: schema.applications.repoUrl,
      branch: schema.applications.branch,
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
  await job.updateProgress({ stage: "clone", percent: 10 });
  await job.log(`[clone] Cloning ${application.repoUrl} (${application.branch})`);

  try {
    const result = await cloneAndBuildApplication(
      job.data.deploymentId,
      application,
    );
    await job.updateProgress({ stage: "build", percent: 75 });
    await job.log(`[build] Image created: ${result.imageTag}`);
    await getDb()
      .update(schema.deployments)
      .set({ commitSha: result.commitSha })
      .where(eq(schema.deployments.id, job.data.deploymentId));
    return { status: "built" as const, ...result };
  } catch (error) {
    await getDb()
      .update(schema.deployments)
      .set({ status: "failed", finishedAt: new Date() })
      .where(eq(schema.deployments.id, job.data.deploymentId));
    throw error;
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
  process.argv[1]?.endsWith("worker.ts") || process.argv[1]?.endsWith("worker.js");

if (isEntrypoint) {
  startWorker();
}
