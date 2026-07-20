"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Box, Database, HardDrive, Layers3 } from "lucide-react";

import { StatusBadge, StatusDot } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { AppStatus, Application, Domain, ServiceInstance, ServiceTemplate } from "@/lib/types";

type CanvasNodeData = {
  kind: "application" | "service";
  name: string;
  status: AppStatus;
  detail: string;
  meta: string;
};

type CanvasNode = Node<CanvasNodeData, "resource">;

const glowByStatus: Record<AppStatus, string> = {
  running: "shadow-[0_0_24px_rgba(16,185,129,0.15)]",
  building: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
  failed: "shadow-[0_0_24px_rgba(239,68,68,0.15)]",
  stopped: "",
};

function ResourceNode({ data }: NodeProps<CanvasNode>) {
  const Icon = data.kind === "application" ? Box : data.meta === "storage" ? HardDrive : data.meta === "cache" ? Layers3 : Database;
  const pulses = data.status === "running" || data.status === "building";

  return (
    <div className={cn("w-[220px] rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-transform hover:-translate-y-px dark:border-neutral-800 dark:bg-neutral-900", glowByStatus[data.status])}>
      <Handle type="target" position={Position.Top} className="!size-2 !border-2 !border-white !bg-neutral-400 dark:!border-neutral-900" />
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-neutral-50 dark:bg-neutral-950">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{data.name}</p>
            <StatusDot status={data.status} className={cn("size-2", pulses && "animate-pulse")} />
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{data.detail}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <span className="truncate text-[11px] capitalize text-muted-foreground">{data.meta}</span>
        <StatusBadge status={data.status} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-2 !border-white !bg-neutral-400 dark:!border-neutral-900" />
    </div>
  );
}

function KiteEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, style, data }: EdgeProps) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const sag = Math.min(80, dist * 0.25);
  const path = `M ${sourceX},${sourceY} C ${sourceX + dx * 0.25},${sourceY + sag} ${sourceX + dx * 0.75},${targetY + sag} ${targetX},${targetY}`;
  const active = Boolean(data?.active);

  return (
    <path id={id} d={path} markerEnd={markerEnd} className="react-flow__edge-path" style={{ ...style, fill: "none", stroke: active ? "#f54900" : "rgba(163, 163, 163, 0.6)", strokeWidth: 1.5, strokeDasharray: active ? "7 6" : undefined }}>
      {active && <animate attributeName="stroke-dashoffset" from="26" to="0" dur="0.8s" repeatCount="indefinite" />}
    </path>
  );
}

const nodeTypes = { resource: ResourceNode };
const edgeTypes = { kite: KiteEdge };

export function ProjectCanvas({ applications, services, templates, domains, activeApplicationIds }: { applications: Application[]; services: ServiceInstance[]; templates: ServiceTemplate[]; domains: Domain[]; activeApplicationIds: string[] }) {
  const initialNodes = useMemo<CanvasNode[]>(() => [
    ...applications.map((app, index) => ({
      id: app.id,
      type: "resource" as const,
      position: { x: 80 + index * 300, y: 55 },
      data: {
        kind: "application" as const,
        name: app.name,
        status: app.status,
        detail: domains.find((domain) => domain.applicationId === app.id && domain.isPrimary)?.hostname ?? app.framework,
        meta: app.framework,
      },
    })),
    ...services.map((service, index) => {
      const template = templates.find((item) => item.id === service.templateId);
      return {
        id: service.id,
        type: "resource" as const,
        position: { x: 150 + index * 300, y: 340 },
        data: { kind: "service" as const, name: service.name, status: service.status, detail: `${template?.name ?? "Service"} ${service.version}`, meta: template?.category ?? "database" },
      };
    }),
  ], [applications, domains, services, templates]);

  const initialEdges = useMemo(() => applications.flatMap((app) => services.map((service) => ({ id: `${app.id}-${service.id}`, source: app.id, target: service.id, type: "kite", data: { active: app.status === "building" || activeApplicationIds.includes(app.id) } }))), [activeApplicationIds, applications, services]);

  if (!applications.length && !services.length) return <div className="flex h-[560px] items-center justify-center rounded-2xl border border-dashed bg-card text-sm text-muted-foreground">No resources in this environment.</div>;

  return (
    <div className="h-[min(680px,calc(100vh-260px))] min-h-[520px] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <ReactFlow nodes={initialNodes} edges={initialEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.25 }} minZoom={0.45} maxZoom={1.6}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="currentColor" className="text-neutral-300/20 dark:text-neutral-700/20" />
        <Controls showInteractive={false} className="!overflow-hidden !rounded-lg !border-neutral-200 !bg-white !shadow-sm dark:!border-neutral-800 dark:!bg-neutral-900 [&_button]:!border-neutral-200 [&_button]:!bg-white [&_button]:!text-neutral-700 dark:[&_button]:!border-neutral-800 dark:[&_button]:!bg-neutral-900 dark:[&_button]:!text-neutral-300" />
      </ReactFlow>
    </div>
  );
}
