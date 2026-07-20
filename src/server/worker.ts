import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";

interface DeploymentJobData {
  deploymentId: string;
  applicationId: string;
}

const stages = [
  ["clone", "Cloning application repository"],
  ["install", "Installing application dependencies"],
  ["build", "Building production artifact"],
  ["start", "Starting application"],
] as const;

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

const worker = new Worker<DeploymentJobData>(
  "deployments",
  async (job: Job<DeploymentJobData>) => {
    await job.log(`Deployment ${job.data.deploymentId} queued`);

    for (const [index, [stage, message]] of stages.entries()) {
      await job.updateProgress({ stage, percent: index * 25 });
      await job.log(`[${stage}] ${message}`);
      await delay(600);
      await job.log(`[${stage}] Completed`);
    }

    await job.updateProgress({ stage: "done", percent: 100 });
    await job.log("Deployment is running");

    return { status: "running" as const };
  },
  { connection },
);

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
