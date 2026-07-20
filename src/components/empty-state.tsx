import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
    <span className="flex size-11 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground"><Icon className="size-5" /></span>
    <h3 className="mt-4 text-sm font-semibold">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>;
}
