import type { Deployment, LogLine } from "@/lib/types";
import { errorResponse } from "@/server/http";
import {
  getDeployment,
  getDeploymentLogs,
  isSimulatedDeployment,
  subscribeToDeployment,
} from "@/server/services/deployments";

const encoder = new TextEncoder();
const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const terminalStatuses = new Set<Deployment["status"]>([
  "running",
  "failed",
  "cancelled",
]);

const fallbackMessages = [
  "Deployment accepted",
  "Preparing workspace",
  "Resolving repository URL",
  "Cloning repository",
  "Checking out target branch",
  "Repository cloned",
  "Reading application manifest",
  "Installing dependencies",
  "Dependencies installed",
  "Running production build",
  "Compiling application",
  "Optimizing assets",
  "Build completed",
  "Preparing runtime configuration",
  "Creating application network",
  "Starting application process",
  "Waiting for health check",
  "Health check passed",
  "Registering route",
  "Deployment is running",
];

function sseHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  };
}

function simulatedLogStream(
  request: Request,
  deployment: Deployment,
  existingLogs: LogLine[],
): ReadableStream<Uint8Array> {
  let unsubscribe: () => void = () => undefined;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (line: LogLine) => {
        if (!closed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`));
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      };

      unsubscribe =
        subscribeToDeployment(deployment.id, (line, current) => {
          send(line);
          if (terminalStatuses.has(current.status)) finish();
        }) ?? unsubscribe;

      for (const line of existingLogs) send(line);
      if (terminalStatuses.has(deployment.status)) finish();

      request.signal.addEventListener(
        "abort",
        () => {
          closed = true;
          unsubscribe();
        },
        { once: true },
      );
    },
    cancel() {
      unsubscribe();
    },
  });
}

function fallbackLogStream(
  request: Request,
  id: string,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [index, message] of fallbackMessages.entries()) {
        if (request.signal.aborted) break;
        const line: LogLine = {
          timestamp: new Date(Date.now() + index * 150).toISOString(),
          stream: index === 0 ? "system" : "stdout",
          message: `[${id}] ${message}`,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`));
        await delay(150);
      }
      if (!request.signal.aborted) {
        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      }
      controller.close();
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deployment = await getDeployment(id);
  if (!deployment) {
    return errorResponse(404, "DEPLOYMENT_NOT_FOUND", "Deployment not found.");
  }

  const stream = isSimulatedDeployment(id)
    ? simulatedLogStream(request, deployment, await getDeploymentLogs(id))
    : fallbackLogStream(request, id);
  return new Response(stream, { headers: sseHeaders() });
}
