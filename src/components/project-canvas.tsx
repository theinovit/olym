"use client";

import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Background, BackgroundVariant, Controls, Handle, NodeToolbar, Position, ReactFlow,
  useEdgesState, useInternalNode, useNodesState, useViewport, type Connection, type Edge, type EdgeProps,
  type Node, type NodeMouseHandler, type NodeProps, type ReactFlowInstance,
} from "@xyflow/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { AlertTriangle, Check, ExternalLink, FileText, GitFork, LoaderCircle, Maximize2, Minimize2, PackageOpen, Plus, RefreshCw, Rocket, Search, Settings, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { BrandIcon } from "@/components/brand-icon";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge, StatusDot } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Application, AppStatus, Binding, Deployment, DeploymentStatus, Domain, EnvironmentName, EnvVar, Framework, LogLine, Project, ServiceInstance, ServiceTemplate } from "@/lib/types";

type CanvasNodeData = {
  kind: "application" | "service";
  name: string;
  status: AppStatus;
  detail: string;
  brand: string;
  application?: Application;
  service?: ServiceInstance;
  template?: ServiceTemplate;
};
type CanvasNode = Node<CanvasNodeData, "resource">;
type PanelTab = "overview" | "variables" | "domains" | "logs" | "settings";
type NodeActionContextValue = {
  selectedNodeId: string | null;
  connectionFocusNodeId: string | null;
  connectedNodeIds: ReadonlySet<string>;
  bindingCounts: Record<string, number>;
  toggleConnectionFocus: (nodeId: string) => void;
  openConfig: (nodeId: string, tab?: PanelTab) => void;
  deploy: (nodeId: string) => void;
  restart: (nodeId: string) => void;
  remove: (nodeId: string) => void;
};
const NodeActionContext = createContext<NodeActionContextValue | null>(null);
const activeDeploymentStatuses = new Set<DeploymentStatus>(["queued", "building", "deploying"]);

function deploymentNodeStatus(status: DeploymentStatus): AppStatus {
  if (activeDeploymentStatuses.has(status)) return "building";
  if (status === "running") return "running";
  if (status === "failed") return "failed";
  return "stopped";
}

const frameworks: { id: Framework; name: string }[] = [
  { id: "nextjs", name: "Next.js" }, { id: "nuxt", name: "Nuxt" },
  { id: "sveltekit", name: "SvelteKit" }, { id: "remix", name: "Remix" },
  { id: "adonisjs", name: "AdonisJS" }, { id: "express", name: "Express" },
  { id: "fastify", name: "Fastify" }, { id: "nestjs", name: "NestJS" },
  { id: "django", name: "Django" },
  { id: "rails", name: "Rails" }, { id: "laravel", name: "Laravel" },
  { id: "symfony", name: "Symfony" }, { id: "blazor", name: "Blazor" },
  { id: "phoenix", name: "Phoenix" }, { id: "static", name: "Static" },
];

const glowByStatus: Record<AppStatus, string> = {
  running: "shadow-[0_0_24px_rgba(16,185,129,0.15)]",
  building: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
  failed: "shadow-[0_0_24px_rgba(239,68,68,0.15)]",
  stopped: "",
};

function ToolbarAction({ label, icon: Icon, onClick, danger = false, badge }: { label: string; icon: typeof Rocket; onClick: () => void; danger?: boolean; badge?: number }) {
  return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" className={cn("nodrag nopan relative", danger && "text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950")} onClick={(event) => { event.stopPropagation(); onClick(); }}><Icon className="size-3.5" />{Boolean(badge) && <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[9px] leading-4 font-semibold text-white">{badge}</span>}<span className="sr-only">{label}</span></Button></TooltipTrigger><TooltipContent side="top" sideOffset={6}>{label}</TooltipContent></Tooltip>;
}

function BindingIndicator({ count, active, onClick }: { count: number; active: boolean; onClick: () => void }) {
  return <Tooltip><TooltipTrigger asChild><button type="button" disabled={!count} aria-pressed={active} className={cn("nodrag nopan flex h-8 items-center gap-1 rounded-full px-2 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-default dark:text-neutral-300 dark:hover:bg-neutral-800", active && "bg-orange-50 text-[#f54900] dark:bg-orange-950/40 dark:text-orange-400")} onClick={(event) => { event.stopPropagation(); onClick(); }}><GitFork className="size-3.5" /><span className={cn("flex min-w-4 items-center justify-center rounded-full px-1 text-[9px] leading-4 font-semibold", count > 0 ? "bg-blue-600 text-white" : "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300")}>{count}</span><span className="sr-only">{active ? "Stop highlighting" : "Highlight"} {count} active bindings</span></button></TooltipTrigger><TooltipContent side="top" sideOffset={6}>{count ? active ? "Clear connected resources" : `Highlight ${count} connected ${count === 1 ? "resource" : "resources"}` : "No active bindings"}</TooltipContent></Tooltip>;
}

function PerimeterHandles({ kind }: { kind: CanvasNodeData["kind"] }) {
  const type = kind === "application" ? "source" : "target";
  const shared = "!absolute !m-0 !rounded-none !border-0 !bg-transparent !opacity-0 !shadow-none !outline-none hover:!bg-transparent hover:!opacity-0 cursor-crosshair";
  const invisibleStyle: CSSProperties = { opacity: 0, background: "transparent", border: 0, boxShadow: "none", outlineStyle: "none", outlineWidth: 0 };
  return <>
    <Handle id={`${type}-top`} type={type} position={Position.Top} style={{ ...invisibleStyle, top: 0, left: 12, width: "calc(100% - 24px)", height: 12, transform: "none" }} className={shared} />
    <Handle id={`${type}-right`} type={type} position={Position.Right} style={{ ...invisibleStyle, top: 12, right: 0, width: 12, height: "calc(100% - 24px)", transform: "none" }} className={shared} />
    <Handle id={`${type}-bottom`} type={type} position={Position.Bottom} style={{ ...invisibleStyle, bottom: 0, left: 12, width: "calc(100% - 24px)", height: 12, transform: "none" }} className={shared} />
    <Handle id={`${type}-left`} type={type} position={Position.Left} style={{ ...invisibleStyle, top: 12, left: 0, width: 12, height: "calc(100% - 24px)", transform: "none" }} className={shared} />
  </>;
}

const ResourceNode = memo(function ResourceNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const actions = useContext(NodeActionContext);
  const internalNode = useInternalNode(id);
  const viewport = useViewport();
  const pulses = data.status === "running" || data.status === "building";
  const screenTop = viewport.y + (internalNode?.internals.positionAbsolute.y ?? 0) * viewport.zoom;
  const toolbarPosition = screenTop < 120 ? Position.Bottom : Position.Top;
  const bindingCount = actions?.bindingCounts[id] ?? 0;
  const connectionFocusActive = Boolean(actions?.connectionFocusNodeId);
  const connectionSource = actions?.connectionFocusNodeId === id;
  const connectionHighlighted = actions?.connectedNodeIds.has(id) ?? false;
  return <div className={cn("w-[220px] rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-[transform,border-color,opacity,box-shadow,filter] hover:-translate-y-px hover:border-dashed hover:border-neutral-400/60 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-500/60", glowByStatus[data.status], selected && "border-dashed border-orange-600 dark:border-orange-600", connectionFocusActive && !connectionSource && !connectionHighlighted && "opacity-25 grayscale-[.35]", connectionSource && "ring-2 ring-[#f54900]/50", connectionHighlighted && "ring-2 ring-[#f54900]/90 shadow-[0_0_28px_rgba(245,73,0,0.22)]")}>
    <NodeToolbar isVisible={selected && actions?.selectedNodeId === id} position={toolbarPosition} offset={10} className="nodrag nopan flex items-center rounded-full border border-neutral-200 bg-white/95 p-1 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/90 dark:shadow-black/40">
      <TooltipProvider><span className="flex items-center gap-0.5"><ToolbarAction label="Deploy" icon={Rocket} onClick={() => actions?.deploy(id)} /><ToolbarAction label="Restart" icon={RefreshCw} onClick={() => actions?.restart(id)} /></span><span className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" /><BindingIndicator count={bindingCount} active={connectionSource} onClick={() => actions?.toggleConnectionFocus(id)} /><span className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" /><span className="flex items-center gap-0.5"><ToolbarAction label="Logs" icon={FileText} onClick={() => actions?.openConfig(id, "logs")} /><ToolbarAction label="Settings" icon={Settings} onClick={() => actions?.openConfig(id, "settings")} /></span><span className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" /><ToolbarAction label="Delete" icon={Trash2} danger onClick={() => actions?.remove(id)} /></TooltipProvider>
    </NodeToolbar>
    <PerimeterHandles kind={data.kind} />
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-neutral-50 dark:bg-neutral-950"><BrandIcon name={data.brand} officialColor className="size-4" /></span>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{data.name}</p><StatusDot status={data.status} className={cn("size-2", pulses && "animate-pulse")} /></div><p className="mt-1 truncate text-xs text-muted-foreground">{data.detail}</p></div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3"><span className="truncate text-[11px] capitalize text-muted-foreground">{data.brand}</span><StatusBadge status={data.status} /></div>
  </div>;
});

function intersectionPoint(node: NonNullable<ReturnType<typeof useInternalNode>>, otherNode: NonNullable<ReturnType<typeof useInternalNode>>) {
  const width = (node.measured.width ?? 0) / 2;
  const height = (node.measured.height ?? 0) / 2;
  const otherWidth = (otherNode.measured.width ?? 0) / 2;
  const otherHeight = (otherNode.measured.height ?? 0) / 2;
  const centerX = node.internals.positionAbsolute.x + width;
  const centerY = node.internals.positionAbsolute.y + height;
  const otherCenterX = otherNode.internals.positionAbsolute.x + otherWidth;
  const otherCenterY = otherNode.internals.positionAbsolute.y + otherHeight;

  if (!width || !height) return { x: centerX, y: centerY };
  const deltaX = otherCenterX - centerX;
  const deltaY = otherCenterY - centerY;
  if (Math.hypot(deltaX, deltaY) < 1) return { x: centerX, y: centerY + height };

  const xx1 = deltaX / (2 * width) - deltaY / (2 * height);
  const yy1 = deltaX / (2 * width) + deltaY / (2 * height);
  const scale = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = scale * xx1;
  const yy3 = scale * yy1;

  return {
    x: width * (xx3 + yy3) + centerX,
    y: height * (-xx3 + yy3) + centerY,
  };
}

const KiteEdge = memo(function KiteEdge({ id, source, target, markerEnd, style, data }: EdgeProps) {
  const actions = useContext(NodeActionContext);
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { x: sourceX, y: sourceY } = intersectionPoint(sourceNode, targetNode);
  const { x: targetX, y: targetY } = intersectionPoint(targetNode, sourceNode);
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const sag = Math.min(120, dist * 0.35);
  const path = `M ${sourceX},${sourceY} C ${sourceX + dx * 0.25},${sourceY + sag} ${sourceX + dx * 0.75},${targetY + sag} ${targetX},${targetY}`;
  const active = Boolean(data?.active);
  const connectionFocus = actions?.connectionFocusNodeId;
  const connectionHighlighted = connectionFocus === source || connectionFocus === target;
  return <path id={id} d={path} markerEnd={markerEnd} className="react-flow__edge-path" vectorEffect="non-scaling-stroke" strokeLinecap="round" style={{ ...style, fill: "none", stroke: active || connectionHighlighted ? "#f54900" : "var(--canvas-edge)", strokeWidth: connectionHighlighted ? 2 : 1.75, strokeDasharray: "7 7", strokeDashoffset: 0, opacity: connectionFocus && !connectionHighlighted ? .15 : 1, transition: "opacity 150ms, stroke 150ms" }}>{active && <animate attributeName="stroke-dashoffset" from="28" to="0" dur=".8s" repeatCount="indefinite" />}</path>;
});

const nodeTypes = { resource: ResourceNode };
const edgeTypes = { kite: KiteEdge };

function injectedKey(template?: ServiceTemplate) {
  const name = template?.name.toLowerCase() ?? "service";
  if (name.includes("redis")) return "REDIS_URL";
  if (name.includes("minio")) return "S3_ENDPOINT";
  if (name.includes("rabbit")) return "AMQP_URL";
  if (template?.category === "search") return "SEARCH_URL";
  return "DATABASE_URL";
}

const deployStages = [
  { label: "Building application...", completePattern: /build completed|image created|building docker image/i },
  { label: "Pushing image...", completePattern: /image created|push(?:ing|ed)? image|registry/i },
  { label: "Provisioning resources...", completePattern: /runtime configuration|application network|provision|container/i },
  { label: "Deploying...", completePattern: /health check passed|registering route|deployment is running|container .* is running/i },
];

function LiveLogs({ deploymentId, deploymentStatus, appUrl }: { deploymentId?: string; deploymentStatus?: DeploymentStatus; appUrl?: string }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamDone, setStreamDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!deploymentId) return;
    const source = new EventSource(`/api/deployments/${deploymentId}/logs`);
    source.onopen = () => setConnected(true);
    source.onmessage = (event) => {
      try { setLines((current) => [...current, JSON.parse(event.data) as LogLine]); } catch { /* malformed lines are ignored */ }
    };
    source.addEventListener("done", () => { setConnected(false); setStreamDone(true); source.close(); });
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [deploymentId]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [lines]);
  const logText = lines.map((line) => line.message).join("\n");
  const succeeded = deploymentStatus === "running" || (streamDone && /deployment is running|container .* is running/i.test(logText));
  const failed = deploymentStatus === "failed" || deploymentStatus === "cancelled";
  const completedStages = deployStages.map((stage) => succeeded || stage.completePattern.test(logText));
  const currentStage = completedStages.findIndex((complete) => !complete);

  return <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-200 shadow-sm">
    <div className="flex items-center border-b border-white/10 bg-neutral-900 px-3 py-2.5"><span className="flex gap-1.5" aria-hidden="true"><span className="size-2.5 rounded-full bg-red-500" /><span className="size-2.5 rounded-full bg-amber-400" /><span className="size-2.5 rounded-full bg-emerald-500" /></span><span className="mx-auto font-mono text-[10px] text-neutral-500">deploy.log</span><span className="flex items-center gap-1.5 text-[10px] text-neutral-400"><span className={cn("size-1.5 rounded-full", connected ? "animate-pulse bg-[#f54900]" : "bg-neutral-600")} />{connected ? "Live" : streamDone || lines.length ? "Complete" : "Connecting"}</span></div>
    <div className="space-y-2 border-b border-white/10 bg-neutral-900/70 p-4 font-mono text-xs">
      {deployStages.map((stage, index) => <div key={stage.label} className={cn("flex items-center gap-2", completedStages[index] ? "text-neutral-200" : index === currentStage && connected ? "text-[#f54900]" : "text-neutral-600")}>
        {completedStages[index] ? <Check className="size-3.5 text-emerald-400" /> : index === currentStage && connected ? <LoaderCircle className="size-3.5 animate-spin" /> : <span className="ml-1 size-1.5 rounded-full bg-neutral-700" />}
        <span>{stage.label}</span>
      </div>)}
      {succeeded && <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/10 pt-3 text-emerald-400"><span>✓ Done! 🎉</span>{appUrl && <a href={appUrl} target="_blank" rel="noreferrer" className="text-[#f54900] underline decoration-[#f54900]/50 underline-offset-4 hover:text-orange-400">Open application <ExternalLink className="inline size-3" /></a>}</div>}
      {failed && <div className="mt-3 border-t border-white/10 pt-3 text-red-400">Deployment failed</div>}
    </div>
    <div className="border-b border-white/10 px-3 py-2 font-mono text-[10px] tracking-wider text-neutral-500 uppercase">Raw stream</div>
    <ScrollArea className="h-[220px]"><div className="space-y-1 p-3 font-mono text-[11px] leading-5">{lines.map((line, index) => <div key={`${line.timestamp}-${index}`} className={line.stream === "stderr" ? "text-red-300" : line.stream === "system" ? "text-orange-300" : ""}><span className="mr-2 text-neutral-600">{new Date(line.timestamp).toLocaleTimeString()}</span>{line.message}</div>)}{!lines.length && <p className="text-neutral-600">Waiting for deployment output…</p>}<div ref={endRef} /></div></ScrollArea>
  </div>;
}

function ApplicationVariables({ application }: { application: Application }) {
  const [variables, setVariables] = useState<EnvVar[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadVariables = async () => {
      try {
        const params = new URLSearchParams({ applicationId: application.id, environment: application.environment });
        const response = await fetch(`/api/env-vars?${params}`, { cache: "no-store" });
        const body = await response.json() as { data?: EnvVar[]; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Could not load variables");
        if (!cancelled) setVariables(body.data ?? []);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load variables");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadVariables();
    return () => { cancelled = true; };
  }, [application.environment, application.id]);

  const addVariable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedKey = key.trim().toUpperCase();
    if (!normalizedKey || !value) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/env-vars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id, environment: application.environment, key: normalizedKey, value }),
      });
      const body = await response.json() as { data?: EnvVar; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Could not add variable");
      setVariables((current) => [body.data!, ...current.filter((item) => item.key !== body.data!.key)]);
      setKey("");
      setValue("");
      toast.success(`${normalizedKey} added`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not add variable");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-4">
    <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={addVariable}>
      <div className="space-y-1.5"><Label htmlFor="variable-key">Name</Label><Input id="variable-key" value={key} onChange={(event) => setKey(event.target.value)} placeholder="API_KEY" autoComplete="off" /></div>
      <div className="space-y-1.5"><Label htmlFor="variable-value">Value</Label><Input id="variable-value" type="password" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Secret value" autoComplete="new-password" /></div>
      <Button type="submit" className="self-end" disabled={saving || !key.trim() || !value}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Add</Button>
    </form>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    {loading ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading variables…</div> : variables.length ? variables.map((variable) => <div key={variable.id} className="rounded-xl border p-3"><Label className="text-xs">{variable.key}</Label><p className="mt-1 font-mono text-xs text-muted-foreground">{variable.maskedValue}</p></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No variables configured for this environment.</p>}
  </div>;
}

function DeploymentHistory({ application, onRedeploy }: { application: Application; onRedeploy: () => void }) {
  const [history, setHistory] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/deployments?appId=${encodeURIComponent(application.id)}`, { cache: "no-store" });
        const body = await response.json() as { data?: Deployment[]; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Could not load deployments");
        if (!cancelled) setHistory((body.data ?? []).slice(0, 5));
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load deployments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadHistory();
    return () => { cancelled = true; };
  }, [application.id]);

  return <section className="space-y-3">
    <div className="flex items-center justify-between"><div><h3 className="font-medium">Deployments</h3><p className="text-xs text-muted-foreground">Latest releases for this application.</p></div><Button type="button" variant="outline" size="sm" onClick={onRedeploy}><RefreshCw className="size-3.5" />Redeploy</Button></div>
    <div className="overflow-hidden rounded-xl border">
      {loading ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading deployments…</div> : error ? <p role="alert" className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p> : history.length ? history.map((item) => <div key={item.id} className="flex items-center gap-3 border-b p-3 last:border-b-0"><StatusBadge status={item.status} /><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs">{item.commitSha.slice(0, 8)}</p><p className="truncate text-xs text-muted-foreground">{item.commitMessage}</p></div><time dateTime={item.startedAt} className="shrink-0 text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.startedAt))}</time></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No deployments yet</p>}
    </div>
  </section>;
}

function ApplicationDomains({ application, initialDomains }: { application: Application; initialDomains: Domain[] }) {
  const [domains, setDomains] = useState(initialDomains);
  const [hostname, setHostname] = useState("");
  const [publicNetwork, setPublicNetwork] = useState(initialDomains.length > 0);
  const [savingDomain, setSavingDomain] = useState(false);
  const [savingNetwork, setSavingNetwork] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setNetworkAccess = async (checked: boolean) => {
    const previous = publicNetwork;
    setPublicNetwork(checked);
    setSavingNetwork(true);
    setError(null);
    try {
      const response = await fetch("/api/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: application.id, publicNetwork: checked }) });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Could not update network access");
      toast.success(checked ? "Public network enabled" : "Application is now internal only");
    } catch (networkError) {
      setPublicNetwork(previous);
      setError(networkError instanceof Error ? networkError.message : "Could not update network access");
    } finally {
      setSavingNetwork(false);
    }
  };

  const addDomain = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedHostname = hostname.trim().toLowerCase();
    if (!normalizedHostname) return;
    setSavingDomain(true);
    setError(null);
    try {
      const response = await fetch("/api/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: application.id, hostname: normalizedHostname, isPrimary: domains.length === 0 }) });
      const body = await response.json() as { data?: Domain; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Could not add domain");
      setDomains((current) => [...current, body.data!]);
      setPublicNetwork(true);
      setHostname("");
      toast.success(`${normalizedHostname} added`);
    } catch (domainError) {
      setError(domainError instanceof Error ? domainError.message : "Could not add domain");
    } finally {
      setSavingDomain(false);
    }
  };

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-4 rounded-xl border p-4"><div><Label htmlFor="public-network">Public network</Label><p className="mt-1 text-xs text-muted-foreground">Expose this application through Traefik.</p></div><Switch id="public-network" checked={publicNetwork} disabled={savingNetwork} onCheckedChange={(checked) => void setNetworkAccess(checked)} /></div>
    <form className="flex gap-2 rounded-xl border p-4" onSubmit={addDomain}><div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor="custom-domain">Custom domain</Label><Input id="custom-domain" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="app.example.com" inputMode="url" autoComplete="off" /></div><Button type="submit" className="self-end" disabled={savingDomain || !hostname.trim()}>{savingDomain ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Add</Button></form>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    {domains.length ? domains.map((domain) => <div key={domain.id} className="flex items-center gap-3 rounded-xl border p-3"><ExternalLink className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{domain.hostname}</p><p className="text-xs capitalize text-muted-foreground">SSL {domain.sslStatus}</p></div>{domain.isPrimary && <span className="text-xs text-muted-foreground">Primary</span>}</div>) : <p className="py-8 text-center text-sm text-muted-foreground">No domains configured for this resource.</p>}
  </div>;
}

function ApplicationHealthCheck() {
  const [path, setPath] = useState("/");
  return <section className="space-y-3 rounded-xl border p-4">
    <div><h3 className="font-medium">Health check</h3><p className="mt-1 text-xs text-muted-foreground">Override the global readiness endpoint for this application.</p></div>
    <div className="flex gap-2"><div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor="health-check-path">Path</Label><Input id="health-check-path" value={path} onChange={(event) => setPath(event.target.value)} placeholder="/health" /></div><Button type="button" variant="outline" className="self-end" disabled>Save</Button></div>
    {/* TODO(BE): persist an application-level healthCheckPath override once the schema/API expose it. */}
    <p className="text-xs text-amber-700 dark:text-amber-400">Backend support is pending. The global readiness path remains active.</p>
  </section>;
}

function NodeConfigDialog({ nodeData, activeTab, onTabChange, onClose, onDeploy, domains, deployments, logDeploymentId }: { nodeData: CanvasNodeData; activeTab: PanelTab; onTabChange: (tab: PanelTab) => void; onClose: () => void; onDeploy: () => void; domains: Domain[]; deployments: Deployment[]; logDeploymentId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const app = nodeData.application;
  const service = nodeData.service;
  const nodeDomains = app ? domains.filter((domain) => domain.applicationId === app.id) : [];
  const deployment = app ? deployments.find((item) => item.applicationId === app.id) : deployments[0];
  const appUrl = nodeDomains.length ? `https://${(nodeDomains.find((domain) => domain.isPrimary) ?? nodeDomains[0]).hostname}` : undefined;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogPortal>
      <DialogOverlay style={{ background: "rgba(0, 0, 0, 0.3)", backdropFilter: "none" }} className="duration-[120ms]" />
      <DialogPrimitive.Content aria-describedby={undefined} style={expanded ? { inset: 16, width: "auto", height: "auto", maxHeight: "none", animation: "none", transform: "none" } : { width: "min(720px, calc(100vw - 2rem))", maxHeight: "80vh", animationDuration: "120ms" }} className={cn("fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-foreground shadow-xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-black/50", !expanded && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2") }>
        <header className="flex shrink-0 items-center gap-3 border-b p-4 pr-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-neutral-50 dark:bg-neutral-950"><BrandIcon name={nodeData.brand} officialColor className="size-5" /></span><div className="min-w-0 flex-1"><DialogTitle className="truncate text-base font-semibold">{nodeData.name}</DialogTitle><p className="text-xs capitalize text-muted-foreground">{nodeData.kind} configuration</p></div><StatusBadge status={nodeData.status} />{app && <Button size="sm" onClick={onDeploy}><Rocket className="size-3.5" />Deploy</Button>}<Button variant="ghost" size="icon-sm" onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}<span className="sr-only">{expanded ? "Exit fullscreen" : "Expand dialog"}</span></Button><Button variant="ghost" size="icon-sm" onClick={onClose}><X className="size-4" /><span className="sr-only">Close configuration</span></Button></header>
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as PanelTab)} className="min-h-0 flex-1 gap-0"><div className="shrink-0 border-b px-5"><TabsList variant="line" className="grid w-full grid-cols-5"><TabsTrigger value="overview" className="min-w-0">Overview</TabsTrigger><TabsTrigger value="variables" className="min-w-0">Variables</TabsTrigger><TabsTrigger value="domains" className="min-w-0">Domains</TabsTrigger><TabsTrigger value="logs" className="min-w-0">Logs</TabsTrigger><TabsTrigger value="settings" className="min-w-0">Settings</TabsTrigger></TabsList></div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
        <TabsContent value="overview" className="space-y-5"><div className="flex items-center justify-between rounded-xl border p-4"><span className="text-muted-foreground">Status</span><StatusBadge status={nodeData.status} /></div><dl className="grid gap-4 rounded-xl border p-4 text-sm">{[[app ? "Framework" : "Service", nodeData.brand], [app ? "Domain" : "Version", app ? nodeDomains.find((domain) => domain.isPrimary)?.hostname ?? "Not configured" : service?.version], ["Install", app?.installCommand ?? "Managed image"], ["Build", app?.buildCommand ?? "Not required"], ["Start", app?.startCommand ?? "Managed by Olym"]].map(([label, value]) => <div key={label} className="grid grid-cols-[90px_1fr] gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="truncate font-mono text-xs">{value}</dd></div>)}</dl>{app && <DeploymentHistory application={app} onRedeploy={onDeploy} />}</TabsContent>
        <TabsContent value="variables">{app ? <ApplicationVariables application={app} /> : <p className="py-10 text-center text-sm text-muted-foreground">Variables are available for applications.</p>}</TabsContent>
        <TabsContent value="domains">{app ? <ApplicationDomains application={app} initialDomains={nodeDomains} /> : <p className="py-10 text-center text-sm text-muted-foreground">Domains are available for applications.</p>}</TabsContent>
        <TabsContent value="logs"><LiveLogs key={logDeploymentId ?? deployment?.id ?? "no-deployment"} deploymentId={logDeploymentId ?? deployment?.id} deploymentStatus={deployment?.status} appUrl={appUrl} /></TabsContent>
        <TabsContent value="settings" className="space-y-4">{app && <ApplicationHealthCheck />}<div className="rounded-xl border border-red-200 p-4 dark:border-red-900"><div className="flex gap-3"><AlertTriangle className="size-4 text-red-600" /><div><h3 className="font-medium text-red-700 dark:text-red-400">Danger zone</h3><p className="mt-1 text-xs text-muted-foreground">Permanently remove this resource and its configuration.</p><Button variant="destructive" size="sm" className="mt-4"><Trash2 className="size-3.5" />Delete resource</Button></div></div></div></TabsContent>
      </div>
    </Tabs>
      </DialogPrimitive.Content>
    </DialogPortal>
  </Dialog>;
}

type PaletteItem = { id: string; name: string; version?: string; description?: string; kind: "application" | "service" };

function AddPalette({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (open: boolean) => void; onAdd: (item: PaletteItem) => void }) {
  const [search, setSearch] = useState("");
  const [services, setServices] = useState<ServiceTemplate[]>([]);
  useEffect(() => {
    if (!open) return;
    fetch("/api/service-templates").then((response) => response.json()).then((body: { data?: ServiceTemplate[] }) => setServices(body.data ?? [])).catch(() => { setServices([]); toast.error("Could not load service catalog"); });
  }, [open]);
  const query = search.trim().toLowerCase();
  const applicationItems: PaletteItem[] = frameworks.map((item) => ({ ...item, kind: "application" as const, description: "Deploy from a Git repository" })).filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query));
  const serviceItems: PaletteItem[] = services.map((item) => ({ id: item.id, name: item.name, version: item.defaultVersion, description: item.description, kind: "service" as const })).filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query));
  const renderItem = (item: PaletteItem) => <button key={`${item.kind}-${item.id}`} draggable type="button" onDragStart={(event) => { event.dataTransfer.setData("application/olym-resource", JSON.stringify(item)); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => onAdd(item)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-white dark:bg-neutral-950"><BrandIcon name={item.id} officialColor className="size-5" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.name}</span><span className="block truncate text-xs text-muted-foreground">{item.version ?? item.description}</span></span></button>;
  return <aside className={cn("absolute top-[72px] bottom-3 left-3 z-20 flex w-[280px] flex-col overflow-hidden rounded-xl border bg-white/95 text-foreground shadow-sm backdrop-blur-sm transition-all duration-150 sm:top-20 dark:border-neutral-700 dark:bg-neutral-900/95 dark:shadow-black/40", open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[calc(100%+1rem)] opacity-0")}>
    <div className="flex items-center gap-2 border-b p-3"><div className="relative flex-1"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter resources…" className="h-8 pl-8" /></div><Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}><X className="size-4" /><span className="sr-only">Close palette</span></Button></div>
    <ScrollArea className="min-h-0 flex-1"><div className="space-y-5 p-3"><section><p className="mb-2 px-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Applications</p><div className="space-y-1">{applicationItems.map(renderItem)}</div></section><section><p className="mb-2 px-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Services</p><div className="space-y-1">{serviceItems.map(renderItem)}</div></section>{!applicationItems.length && !serviceItems.length && <p className="py-8 text-center text-sm text-muted-foreground">No resources found.</p>}</div></ScrollArea>
    <p className="border-t px-3 py-2 text-[10px] text-muted-foreground">Click to add · drag to place · A to toggle</p>
  </aside>;
}

export function ProjectCanvas({ project, environment, applications, services, templates, domains, deployments, bindings, activeApplicationIds, addOpen, onAddOpenChange }: { project: Project; environment: EnvironmentName; applications: Application[]; services: ServiceInstance[]; templates: ServiceTemplate[]; domains: Domain[]; deployments: Deployment[]; bindings: Binding[]; activeApplicationIds: string[]; addOpen: boolean; onAddOpenChange: (open: boolean) => void }) {
  const initialNodes = useMemo<CanvasNode[]>(() => [...applications.map((app, index) => ({ id: app.id, type: "resource" as const, position: { x: 80 + index * 300, y: 55 }, data: { kind: "application" as const, name: app.name, status: app.status, detail: domains.find((domain) => domain.applicationId === app.id && domain.isPrimary)?.hostname ?? app.framework, brand: app.framework, application: app } })), ...services.map((service, index) => { const template = templates.find((item) => item.id === service.templateId); return { id: service.id, type: "resource" as const, position: { x: 150 + index * 300, y: 340 }, data: { kind: "service" as const, name: service.name, status: service.status, detail: `${template?.name ?? "Service"} ${service.version}`, brand: template?.id ?? service.templateId, service, template } }; })], [applications, domains, services, templates]);
  const initialEdges = useMemo<Edge[]>(() => bindings.filter((binding) => applications.some((app) => app.id === binding.applicationId) && services.some((service) => service.id === binding.serviceInstanceId)).map((binding) => ({ id: binding.id, source: binding.applicationId, target: binding.serviceInstanceId, type: "kite", data: { active: activeApplicationIds.includes(binding.applicationId), injectedVarKey: binding.injectedVarKey } })), [activeApplicationIds, applications, bindings, services]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectionFocusNodeId, setConnectionFocusNodeId] = useState<string | null>(null);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<PanelTab>("overview");
  const [runtimeDeployments, setRuntimeDeployments] = useState<Deployment[]>([]);
  const [logDeploymentByApp, setLogDeploymentByApp] = useState<Record<string, string>>({});
  const flowRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const selectedNode = nodes.find((node) => node.id === configNodeId) ?? null;
  const allDeployments = useMemo(() => {
    const runtimeIds = new Set(runtimeDeployments.map((deployment) => deployment.id));
    return [...runtimeDeployments, ...deployments.filter((deployment) => !runtimeIds.has(deployment.id))];
  }, [deployments, runtimeDeployments]);
  const activeRuntimeKey = runtimeDeployments
    .filter((deployment) => activeDeploymentStatuses.has(deployment.status))
    .map((deployment) => `${deployment.id}:${deployment.status}:${deployment.applicationId}`)
    .sort()
    .join("|");
  const bindingCounts = useMemo(() => edges.reduce<Record<string, number>>((counts, edge) => {
    counts[edge.source] = (counts[edge.source] ?? 0) + 1;
    counts[edge.target] = (counts[edge.target] ?? 0) + 1;
    return counts;
  }, {}), [edges]);
  const connectedNodeIds = useMemo(() => {
    const connected = new Set<string>();
    if (!connectionFocusNodeId) return connected;
    for (const edge of edges) {
      if (edge.source === connectionFocusNodeId) connected.add(edge.target);
      if (edge.target === connectionFocusNodeId) connected.add(edge.source);
    }
    return connected;
  }, [connectionFocusNodeId, edges]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "a" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); onAddOpenChange(!addOpen); }
      if (event.key === "Escape") {
        setConfigNodeId(null);
        setConnectionFocusNodeId(null);
        setSelectedNodeId(null);
        setNodes((current) => current.map((node) => ({ ...node, selected: false })));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [addOpen, onAddOpenChange, setNodes]);

  const openConfig = (nodeId: string, tab: PanelTab = "overview") => {
    if (!nodes.some((item) => item.id === nodeId)) return;
    setSelectedNodeId(nodeId);
    setConfigNodeId(nodeId);
    setConfigTab(tab);
  };
  const closeConfig = () => setConfigNodeId(null);
  const showDeploymentLogs = useCallback((applicationId: string, deploymentId: string) => {
    setLogDeploymentByApp((current) => ({ ...current, [applicationId]: deploymentId }));
    setSelectedNodeId(applicationId);
    setConfigNodeId(applicationId);
    setConfigTab("logs");
  }, []);
  const deployApplication = useCallback(async (nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId);
    const applicationId = node?.data.application?.id;
    if (!applicationId) { toast.error("Only applications can be deployed"); return; }
    try {
      const response = await fetch("/api/deployments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId }) });
      const body = await response.json() as { data?: { deploymentId: string }; error?: { message?: string } };
      if (!response.ok || !body.data?.deploymentId) throw new Error(body.error?.message ?? "Could not start deployment");
      const detailResponse = await fetch(`/api/deployments/${body.data.deploymentId}`);
      const detailBody = await detailResponse.json() as { data?: Deployment };
      if (!detailResponse.ok || !detailBody.data) throw new Error("Deployment started, but its status could not be loaded");
      const deployment = detailBody.data;
      setRuntimeDeployments((current) => [deployment, ...current.filter((item) => item.id !== deployment.id)]);
      setNodes((current) => current.map((item) => item.id === applicationId ? { ...item, data: { ...item.data, status: deploymentNodeStatus(deployment.status) } } : item));
      setEdges((current) => current.map((edge) => edge.source === applicationId ? { ...edge, data: { ...edge.data, active: true } } : edge));
      showDeploymentLogs(applicationId, deployment.id);
      toast.success(`Deploy queued for ${node.data.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start deployment");
    }
  }, [nodes, setEdges, setNodes, showDeploymentLogs]);

  useEffect(() => {
    if (!activeRuntimeKey) return;
    const active = activeRuntimeKey.split("|").map((entry) => {
      const [id, status, applicationId] = entry.split(":") as [string, DeploymentStatus, string];
      return { id, status, applicationId };
    });
    let cancelled = false;
    const poll = async () => {
      const results = await Promise.all(active.map(async (deployment) => {
        try {
          const response = await fetch(`/api/deployments/${deployment.id}`, { cache: "no-store" });
          const body = await response.json() as { data?: Deployment };
          return response.ok && body.data ? { previous: deployment, next: body.data } : null;
        } catch { return null; }
      }));
      if (cancelled) return;
      for (const result of results) {
        if (!result) continue;
        const { previous, next } = result;
        setRuntimeDeployments((current) => [next, ...current.filter((item) => item.id !== next.id)]);
        setNodes((current) => current.map((item) => item.id === next.applicationId ? { ...item, data: { ...item.data, status: deploymentNodeStatus(next.status) } } : item));
        const hasAnotherActiveDeployment = activeApplicationIds.includes(next.applicationId) || active.some((deployment) => deployment.id !== next.id && deployment.applicationId === next.applicationId);
        setEdges((current) => current.map((edge) => edge.source === next.applicationId ? { ...edge, data: { ...edge.data, active: activeDeploymentStatuses.has(next.status) || hasAnotherActiveDeployment } } : edge));
        if (activeDeploymentStatuses.has(previous.status) && !activeDeploymentStatuses.has(next.status)) {
          const action = { label: "Ver logs", onClick: () => showDeploymentLogs(next.applicationId, next.id) };
          if (next.status === "running") toast.success("Deployment completed successfully", { action });
          else if (next.status === "failed") toast.error("Deployment failed", { action });
        }
      }
    };
    const timer = window.setInterval(poll, 2000);
    void poll();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeApplicationIds, activeRuntimeKey, setEdges, setNodes, showDeploymentLogs]);
  const removeNode = (nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId);
    setNodes((current) => current.filter((item) => item.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeId(null);
    setConfigNodeId(null);
    toast.success(`${node?.data.name ?? "Resource"} removed from the canvas`);
  };
  const onNodeClick: NodeMouseHandler<CanvasNode> = (_, node) => {
    if (connectionFocusNodeId && !connectedNodeIds.has(node.id)) return;
    setConnectionFocusNodeId(null);
    setSelectedNodeId(node.id);
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })));
  };
  const actionContext: NodeActionContextValue = {
    selectedNodeId, connectionFocusNodeId, connectedNodeIds, bindingCounts, openConfig,
    toggleConnectionFocus: (nodeId) => setConnectionFocusNodeId((current) => current === nodeId ? null : nodeId),
    deploy: deployApplication,
    restart: (nodeId) => toast.success(`Restart queued for ${nodes.find((node) => node.id === nodeId)?.data.name ?? "resource"}`),
    remove: removeNode,
  };
  const onConnect = (connection: Connection) => {
    const source = nodes.find((node) => node.id === connection.source);
    const target = nodes.find((node) => node.id === connection.target);
    if (!source || !target || source.data.kind !== "application" || target.data.kind !== "service") { toast.error("Connect an application to a service"); return; }
    if (edges.some((edge) => edge.source === source.id && edge.target === target.id)) { toast.error("These resources are already connected"); return; }
    const key = injectedKey(target.data.template);
    setEdges((current) => [...current, { ...connection, id: `binding_${Date.now()}`, type: "kite", data: { injectedVarKey: key } } as Edge]);
    toast.success(`${key} injected into ${source.data.name}`);
  };
  const addResource = (item: PaletteItem, position?: { x: number; y: number }) => {
    const { kind } = item;
    const id = `${kind}_${Date.now()}`;
    const app = kind === "application" ? { id, projectId: project.id, environment, name: `${project.slug}-${item.id}`, framework: item.id as Framework, repoUrl: "", branch: "main", installCommand: "pnpm install", buildCommand: "pnpm build", startCommand: "pnpm start", outputDirectory: null, port: 3000, status: "stopped" as const, createdAt: new Date().toISOString() } : undefined;
    const template = kind === "service" ? templates.find((entry) => entry.id === item.id) ?? { id: item.id, name: item.name, description: "Managed service", category: "database" as const, defaultVersion: item.version ?? "latest" } : undefined;
    const service = kind === "service" ? { id, projectId: project.id, environment, templateId: item.id, name: `${project.slug}-${item.id}`, version: item.version ?? "latest", status: "building" as const, createdAt: new Date().toISOString() } : undefined;
    setNodes((current) => [...current, { id, type: "resource", position: position ?? { x: 180 + (current.length % 3) * 280, y: 150 + Math.floor(current.length / 3) * 230 }, data: { kind, name: app?.name ?? service!.name, status: app?.status ?? service!.status, detail: app ? item.name : `${item.name} ${item.version ?? "latest"}`, brand: item.id, application: app, service, template } }]);
    toast.success(`${item.name} added to the canvas`);
  };

  return <>
    <style>{`.olym-project-canvas { --canvas-edge: rgba(115, 115, 115, 0.82); } .dark .olym-project-canvas { --canvas-edge: rgba(163, 163, 163, 0.78); } .olym-project-canvas aside { left: 96px; } .canvas-add-button { top: 80px; right: 16px; z-index: 10; }`}</style>
    <div className="olym-project-canvas relative h-svh w-full overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <NodeActionContext.Provider value={actionContext}><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} onNodeDoubleClick={(_, node) => openConfig(node.id)} onPaneClick={() => { setConnectionFocusNodeId(null); setSelectedNodeId(null); setConfigNodeId(null); setNodes((current) => current.map((node) => ({ ...node, selected: false }))); }} onInit={(instance) => { flowRef.current = instance; }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); const raw = event.dataTransfer.getData("application/olym-resource"); if (!raw || !flowRef.current) return; try { addResource(JSON.parse(raw) as PaletteItem, flowRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })); } catch { toast.error("Could not add this resource"); } }} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: { x: .25, y: .45 } }} minZoom={.45} maxZoom={1.6} deleteKeyCode={["Backspace", "Delete"]}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="currentColor" className="text-neutral-300/20 dark:text-neutral-700/20" />
        <Controls showInteractive={false} style={{ left: 96, bottom: 16 }} className="!overflow-hidden !rounded-lg !border-neutral-200 !bg-white !shadow-sm dark:!border-neutral-800 dark:!bg-neutral-900 [&_button]:!border-neutral-200 [&_button]:!bg-white [&_button]:!text-neutral-700 dark:[&_button]:!border-neutral-800 dark:[&_button]:!bg-neutral-900 dark:[&_button]:!text-neutral-300" />
      </ReactFlow></NodeActionContext.Provider>
      <AddPalette open={addOpen} onOpenChange={onAddOpenChange} onAdd={addResource} />
      <Button className="canvas-add-button absolute rounded-full shadow-sm" onClick={() => onAddOpenChange(!addOpen)}><Plus className="size-4" />Add <kbd className="rounded border border-white/20 px-1 text-[10px]">A</kbd></Button>
      {!nodes.length && <EmptyState icon={PackageOpen} title="Add your first service" description="Start with an application or managed database." action={<Button onClick={() => onAddOpenChange(true)}><Plus className="size-4" />Add resource</Button>} className="absolute top-1/2 left-1/2 z-10 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dashed bg-white/90 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/90" />}
    </div>
    {selectedNode && <NodeConfigDialog key={selectedNode.id} nodeData={selectedNode.data} activeTab={configTab} onTabChange={(tab) => openConfig(selectedNode.id, tab)} onClose={closeConfig} onDeploy={() => void deployApplication(selectedNode.id)} domains={domains} deployments={allDeployments} logDeploymentId={selectedNode.data.application ? logDeploymentByApp[selectedNode.data.application.id] : undefined} />}
  </>;
}
