import { Queue } from "bullmq";
import IORedis from "ioredis";

export const DEPLOYMENTS_QUEUE_NAME = "deployments";

export interface DeploymentJobData {
  deploymentId: string;
  applicationId: string;
}

let connection: IORedis | undefined;
let deploymentsQueue: Queue<DeploymentJobData> | undefined;

function getRedisConnection(redisUrl: string): IORedis {
  connection ??= new IORedis(
    redisUrl,
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

export function getDeploymentsQueue(redisUrl: string): Queue<DeploymentJobData> {
  if (!deploymentsQueue) {
    deploymentsQueue = new Queue<DeploymentJobData>(DEPLOYMENTS_QUEUE_NAME, {
      connection: getRedisConnection(redisUrl),
    });
    deploymentsQueue.on("error", () => {
      // enqueueDeployment surfaces the failure to its simulated-mode caller.
    });
  }

  return deploymentsQueue;
}

export async function enqueueDeployment(
  data: DeploymentJobData,
): Promise<"redis" | "simulated"> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return "simulated";

  try {
    const redis = getRedisConnection(redisUrl);
    if (redis.status === "wait") await redis.connect();
    await redis.ping();
    const queue = getDeploymentsQueue(redisUrl);
    await queue.add("deploy", data, {
      jobId: data.deploymentId,
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return "redis";
  } catch (error) {
    await deploymentsQueue?.close().catch(() => undefined);
    connection?.disconnect();
    deploymentsQueue = undefined;
    connection = undefined;
    void error;
    return "simulated";
  }
}
