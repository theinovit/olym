import type { LogLine } from "@/lib/types";

const encoder = new TextEncoder();
const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const messages = [
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [index, message] of messages.entries()) {
        if (request.signal.aborted) break;

        const line: LogLine = {
          timestamp: new Date(Date.now() + index * 150).toISOString(),
          stream: index === 0 ? "system" : "stdout",
          message: `[${id}] ${message}`,
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(line)}\n\n`),
        );
        await delay(150);
      }

      if (!request.signal.aborted) {
        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
