import IORedis from "ioredis";

import type { DeploymentStatus, LogLine } from "@/lib/types";

export interface DeploymentEvent {
  line: LogLine;
  status?: DeploymentStatus;
}

const channel = (id: string) => `olym:deployments:${id}:events`;
const historyKey = (id: string) => `olym:deployments:${id}:logs`;

function redisUrl(): string {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL is required for deployment events");
  return url;
}

export async function publishDeploymentEvent(
  redis: IORedis,
  deploymentId: string,
  event: DeploymentEvent,
): Promise<void> {
  const payload = JSON.stringify(event);
  await redis
    .multi()
    .rpush(historyKey(deploymentId), payload)
    .ltrim(historyKey(deploymentId), -2_000, -1)
    .expire(historyKey(deploymentId), 60 * 60 * 24 * 7)
    .publish(channel(deploymentId), payload)
    .exec();
}

export async function getDeploymentEventHistory(
  deploymentId: string,
): Promise<DeploymentEvent[]> {
  const redis = new IORedis(redisUrl(), { maxRetriesPerRequest: 1 });
  try {
    return (await redis.lrange(historyKey(deploymentId), 0, -1)).map(
      (payload) => JSON.parse(payload) as DeploymentEvent,
    );
  } finally {
    await redis.quit();
  }
}

export async function subscribeToDeploymentEvents(
  deploymentId: string,
  listener: (event: DeploymentEvent) => void,
): Promise<() => void> {
  const subscriber = new IORedis(redisUrl(), { maxRetriesPerRequest: null });
  subscriber.on("message", (_channel, payload) => {
    listener(JSON.parse(payload) as DeploymentEvent);
  });
  await subscriber.subscribe(channel(deploymentId));
  return () => {
    void subscriber.unsubscribe(channel(deploymentId)).finally(() =>
      subscriber.quit(),
    );
  };
}
