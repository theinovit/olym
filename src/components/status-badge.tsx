import { cn } from "@/lib/utils";
import type { AppStatus, DeploymentStatus, ServerStatus } from "@/lib/types";

type Status = AppStatus | DeploymentStatus | ServerStatus;

type Tone = "success" | "pending" | "danger" | "neutral";

const toneByStatus: Record<Status, Tone> = {
  running: "success",
  online: "success",
  queued: "pending",
  building: "pending",
  deploying: "pending",
  provisioning: "pending",
  failed: "danger",
  offline: "danger",
  stopped: "neutral",
  cancelled: "neutral",
};

const dotClasses: Record<Tone, string> = {
  success: "bg-emerald-500",
  pending: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-neutral-400 dark:bg-neutral-500",
};

const badgeClasses: Record<Tone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  pending:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  neutral:
    "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400",
};

export function StatusDot({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        dotClasses[toneByStatus[status]],
        className
      )}
    />
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-medium capitalize",
        badgeClasses[toneByStatus[status]],
        className
      )}
    >
      <StatusDot status={status} className="size-1.5" />
      {status}
    </span>
  );
}
