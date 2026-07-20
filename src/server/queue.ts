import { Queue } from "bullmq";
import IORedis from "ioredis";

export const DEPLOYMENTS_QUEUE_NAME = "deployments";

export interface DeploymentJobData {
  deploymentId: string;
  applicationId: string;
}

let connection: IORedis | undefined;
let deploymentsQueue: Queue<DeploymentJobData> | undefined;

function getRedisConnection(): IORedis {
  connection ??= new IORedis(
    process.env.REDIS_URL ?? "redis://localhost:6379",
    {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 1_000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    },
  );

  connection.on("error", () => {
    // Queue callers handle Redis failures by falling back to simulated mode.
  });

  return connection;
}

export function getDeploymentsQueue(): Queue<DeploymentJobData> {
  if (!deploymentsQueue) {
    deploymentsQueue = new Queue<DeploymentJobData>(DEPLOYMENTS_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
    deploymentsQueue.on("error", () => {
      // enqueueDeployment surfaces the failure to its simulated-mode caller.
    });
  }

  return deploymentsQueue;
}

export async function enqueueDeployment(
  data: DeploymentJobData,
): Promise<void> {
  const queue = getDeploymentsQueue();

  try {
    await queue.add("deploy", data, {
      jobId: data.deploymentId,
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  } catch (error) {
    await queue.close().catch(() => undefined);
    connection?.disconnect();
    deploymentsQueue = undefined;
    connection = undefined;
    throw error;
  }
}
