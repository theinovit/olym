"use client";

import { createContext, memo, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Background, BackgroundVariant, Controls, Handle, NodeToolbar, Position, ReactFlow,
  useEdgesState, useInternalNode, useNodesState, type Connection, type Edge, type EdgeProps,
  type Node, type NodeMouseHandler, type NodeProps, type ReactFlowInstance,
} from "@xyflow/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { AlertTriangle, ExternalLink, FileText, Maximize2, Minimize2, PackageOpen, Plus, RefreshCw, Rocket, Search, Settings, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { BrandIcon } from "@/components/brand-icon";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge, StatusDot } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Application, AppStatus, Binding, Deployment, Domain, Framework, LogLine, Project, ServiceInstance, ServiceTemplate } from "@/lib/types";

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
  deployments: Deployment[];
  openConfig: (nodeId: string, tab?: PanelTab) => void;
  deploy: (nodeId: string) => void;
  restart: (nodeId: string) => void;
  remove: (nodeId: string) => void;
};
const NodeActionContext = createContext<NodeActionContextValue | null>(null);

const frameworks: { id: Framework; name: string }[] = [
  { id: "nextjs", name: "Next.js" }, { id: "nuxt", name: "Nuxt" },
  { id: "sveltekit", name: "SvelteKit" }, { id: "remix", name: "Remix" },
  { id: "adonisjs", name: "AdonisJS" }, { id: "django", name: "Django" },
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
  const pulses = data.status === "running" || data.status === "building";
  const activeDeployments = data.application ? actions?.deployments.filter((deployment) => deployment.applicationId === data.application?.id && ["queued", "building", "deploying"].includes(deployment.status)).length ?? 0 : 0;
  return <div className={cn("w-[220px] rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-[transform,border-color] hover:-translate-y-px hover:border-dashed hover:border-neutral-400/60 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-500/60", glowByStatus[data.status], selected && "border-dashed border-orange-600 dark:border-orange-600")}>
    <NodeToolbar isVisible={selected && actions?.selectedNodeId === id} position={Position.Top} offset={8} className="nodrag nopan flex items-center rounded-full border border-neutral-200 bg-white/95 p-1 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/90 dark:shadow-black/40">
      <TooltipProvider><span className="flex items-center gap-0.5"><ToolbarAction label="Deploy" icon={Rocket} onClick={() => actions?.deploy(id)} /><ToolbarAction label="Restart" icon={RefreshCw} onClick={() => actions?.restart(id)} /></span><span className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" /><span className="flex items-center gap-0.5"><ToolbarAction label="Logs" icon={FileText} badge={activeDeployments} onClick={() => actions?.openConfig(id, "logs")} /><ToolbarAction label="Settings" icon={Settings} onClick={() => actions?.openConfig(id, "settings")} /></span><span className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" /><ToolbarAction label="Delete" icon={Trash2} danger onClick={() => actions?.remove(id)} /></TooltipProvider>
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
  return <path id={id} d={path} markerEnd={markerEnd} className="react-flow__edge-path" style={{ ...style, fill: "none", stroke: active ? "#f54900" : "var(--canvas-edge)", strokeWidth: 1.5, strokeDasharray: "7 7" }}>{active && <animate attributeName="stroke-dashoffset" from="28" to="0" dur=".8s" repeatCount="indefinite" />}</path>;
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

function LiveLogs({ deploymentId }: { deploymentId?: string }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!deploymentId) return;
    const source = new EventSource(`/api/deployments/${deploymentId}/logs`);
    source.onopen = () => setConnected(true);
    source.onmessage = (event) => {
      try { setLines((current) => [...current, JSON.parse(event.data) as LogLine]); } catch { /* malformed lines are ignored */ }
    };
    source.addEventListener("done", () => { setConnected(false); source.close(); });
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [deploymentId]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [lines]);
  return <div className="overflow-hidden rounded-xl border bg-neutral-950 text-neutral-200"><div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs text-neutral-400"><span className={cn("size-1.5 rounded-full", connected ? "animate-pulse bg-emerald-400" : "bg-neutral-600")} />{connected ? "Streaming live" : lines.length ? "Stream complete" : "Connecting…"}</div><ScrollArea className="h-[270px]"><div className="space-y-1 p-3 font-mono text-[11px] leading-5">{lines.map((line, index) => <div key={`${line.timestamp}-${index}`} className={line.stream === "stderr" ? "text-red-300" : line.stream === "system" ? "text-amber-300" : ""}><span className="mr-2 text-neutral-600">{new Date(line.timestamp).toLocaleTimeString()}</span>{line.message}</div>)}<div ref={endRef} /></div></ScrollArea></div>;
}

function NodeConfigDialog({ nodeData, activeTab, onTabChange, onClose, domains, deployments }: { nodeData: CanvasNodeData; activeTab: PanelTab; onTabChange: (tab: PanelTab) => void; onClose: () => void; domains: Domain[]; deployments: Deployment[] }) {
  const [expanded, setExpanded] = useState(false);
  const app = nodeData.application;
  const service = nodeData.service;
  const nodeDomains = app ? domains.filter((domain) => domain.applicationId === app.id) : [];
  const deployment = app ? deployments.find((item) => item.applicationId === app.id) : deployments[0];
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogPortal>
      <DialogOverlay style={{ background: "rgba(0, 0, 0, 0.3)", backdropFilter: "none" }} className="duration-[120ms]" />
      <DialogPrimitive.Content aria-describedby={undefined} style={expanded ? { inset: 16, width: "auto", height: "auto", maxHeight: "none", animation: "none", transform: "none" } : { width: "min(720px, calc(100vw - 2rem))", maxHeight: "80vh", animationDuration: "120ms" }} className={cn("fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-foreground shadow-xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-black/50", !expanded && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2") }>
        <header className="flex shrink-0 items-center gap-3 border-b p-4 pr-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-neutral-50 dark:bg-neutral-950"><BrandIcon name={nodeData.brand} officialColor className="size-5" /></span><div className="min-w-0 flex-1"><DialogTitle className="truncate text-base font-semibold">{nodeData.name}</DialogTitle><p className="text-xs capitalize text-muted-foreground">{nodeData.kind} configuration</p></div><StatusBadge status={nodeData.status} /><Button variant="ghost" size="icon-sm" onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}<span className="sr-only">{expanded ? "Exit fullscreen" : "Expand dialog"}</span></Button><Button variant="ghost" size="icon-sm" onClick={onClose}><X className="size-4" /><span className="sr-only">Close configuration</span></Button></header>
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as PanelTab)} className="min-h-0 flex-1 gap-0"><div className="shrink-0 border-b px-5"><TabsList variant="line" className="max-w-full overflow-x-auto"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="variables">Variables</TabsTrigger><TabsTrigger value="domains">Domains</TabsTrigger><TabsTrigger value="logs">Logs</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger></TabsList></div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
        <TabsContent value="overview" className="space-y-5"><div className="flex items-center justify-between rounded-xl border p-4"><span className="text-muted-foreground">Status</span><StatusBadge status={nodeData.status} /></div><dl className="grid gap-4 rounded-xl border p-4 text-sm">{[[app ? "Framework" : "Service", nodeData.brand], [app ? "Domain" : "Version", app ? nodeDomains.find((domain) => domain.isPrimary)?.hostname ?? "Not configured" : service?.version], ["Install", app?.installCommand ?? "Managed image"], ["Build", app?.buildCommand ?? "Not required"], ["Start", app?.startCommand ?? "Managed by Hefesto"]].map(([label, value]) => <div key={label} className="grid grid-cols-[90px_1fr] gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="truncate font-mono text-xs">{value}</dd></div>)}</dl></TabsContent>
        <TabsContent value="variables" className="space-y-3">{["DATABASE_URL", "NODE_ENV", "SESSION_SECRET"].map((key) => <div key={key} className="rounded-xl border p-3"><Label className="text-xs">{key}</Label><p className="mt-1 font-mono text-xs text-muted-foreground">••••••••••••••••</p></div>)}</TabsContent>
        <TabsContent value="domains" className="space-y-3">{nodeDomains.length ? nodeDomains.map((domain) => <div key={domain.id} className="flex items-center gap-3 rounded-xl border p-3"><ExternalLink className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{domain.hostname}</p><p className="text-xs capitalize text-muted-foreground">SSL {domain.sslStatus}</p></div>{domain.isPrimary && <span className="text-xs text-muted-foreground">Primary</span>}</div>) : <p className="py-10 text-center text-sm text-muted-foreground">No domains configured for this resource.</p>}</TabsContent>
        <TabsContent value="logs"><LiveLogs deploymentId={deployment?.id} /></TabsContent>
        <TabsContent value="settings"><div className="rounded-xl border border-red-200 p-4 dark:border-red-900"><div className="flex gap-3"><AlertTriangle className="size-4 text-red-600" /><div><h3 className="font-medium text-red-700 dark:text-red-400">Danger zone</h3><p className="mt-1 text-xs text-muted-foreground">Permanently remove this resource and its configuration.</p><Button variant="destructive" size="sm" className="mt-4"><Trash2 className="size-3.5" />Delete resource</Button></div></div></div></TabsContent>
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
  const renderItem = (item: PaletteItem) => <button key={`${item.kind}-${item.id}`} draggable type="button" onDragStart={(event) => { event.dataTransfer.setData("application/hefesto-resource", JSON.stringify(item)); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => onAdd(item)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-white dark:bg-neutral-950"><BrandIcon name={item.id} officialColor className="size-5" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.name}</span><span className="block truncate text-xs text-muted-foreground">{item.version ?? item.description}</span></span></button>;
  return <aside className={cn("absolute inset-y-3 left-3 z-20 flex w-[280px] flex-col overflow-hidden rounded-xl border bg-white/95 text-foreground shadow-sm backdrop-blur-sm transition-all duration-150 dark:border-neutral-700 dark:bg-neutral-900/95 dark:shadow-black/40", open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[calc(100%+1rem)] opacity-0")}>
    <div className="flex items-center gap-2 border-b p-3"><div className="relative flex-1"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter resources…" className="h-8 pl-8" /></div><Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}><X className="size-4" /><span className="sr-only">Close palette</span></Button></div>
    <ScrollArea className="min-h-0 flex-1"><div className="space-y-5 p-3"><section><p className="mb-2 px-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Applications</p><div className="space-y-1">{applicationItems.map(renderItem)}</div></section><section><p className="mb-2 px-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Services</p><div className="space-y-1">{serviceItems.map(renderItem)}</div></section>{!applicationItems.length && !serviceItems.length && <p className="py-8 text-center text-sm text-muted-foreground">No resources found.</p>}</div></ScrollArea>
    <p className="border-t px-3 py-2 text-[10px] text-muted-foreground">Click to add · drag to place · A to toggle</p>
  </aside>;
}

export function ProjectCanvas({ project, applications, services, templates, domains, deployments, bindings, activeApplicationIds }: { project: Project; applications: Application[]; services: ServiceInstance[]; templates: ServiceTemplate[]; domains: Domain[]; deployments: Deployment[]; bindings: Binding[]; activeApplicationIds: string[] }) {
  const initialNodes = useMemo<CanvasNode[]>(() => [...applications.map((app, index) => ({ id: app.id, type: "resource" as const, position: { x: 80 + index * 300, y: 55 }, data: { kind: "application" as const, name: app.name, status: app.status, detail: domains.find((domain) => domain.applicationId === app.id && domain.isPrimary)?.hostname ?? app.framework, brand: app.framework, application: app } })), ...services.map((service, index) => { const template = templates.find((item) => item.id === service.templateId); return { id: service.id, type: "resource" as const, position: { x: 150 + index * 300, y: 340 }, data: { kind: "service" as const, name: service.name, status: service.status, detail: `${template?.name ?? "Service"} ${service.version}`, brand: template?.id ?? service.templateId, service, template } }; })], [applications, domains, services, templates]);
  const initialEdges = useMemo<Edge[]>(() => bindings.filter((binding) => applications.some((app) => app.id === binding.applicationId) && services.some((service) => service.id === binding.serviceInstanceId)).map((binding) => ({ id: binding.id, source: binding.applicationId, target: binding.serviceInstanceId, type: "kite", data: { active: activeApplicationIds.includes(binding.applicationId), injectedVarKey: binding.injectedVarKey } })), [activeApplicationIds, applications, bindings, services]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<PanelTab>("overview");
  const [addOpen, setAddOpen] = useState(false);
  const flowRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const selectedNode = nodes.find((node) => node.id === configNodeId) ?? null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "a" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); setAddOpen((value) => !value); }
      if (event.key === "Escape") setConfigNodeId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const openConfig = (nodeId: string, tab: PanelTab = "overview") => {
    if (!nodes.some((item) => item.id === nodeId)) return;
    setSelectedNodeId(nodeId);
    setConfigNodeId(nodeId);
    setConfigTab(tab);
  };
  const closeConfig = () => setConfigNodeId(null);
  const removeNode = (nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId);
    setNodes((current) => current.filter((item) => item.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeId(null);
    setConfigNodeId(null);
    toast.success(`${node?.data.name ?? "Resource"} removed from the canvas`);
  };
  const onNodeClick: NodeMouseHandler<CanvasNode> = (_, node) => {
    setSelectedNodeId(node.id);
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })));
    openConfig(node.id, "overview");
  };
  const actionContext: NodeActionContextValue = {
    selectedNodeId, deployments, openConfig,
    deploy: (nodeId) => toast.success(`Deploy queued for ${nodes.find((node) => node.id === nodeId)?.data.name ?? "resource"}`),
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
    const app = kind === "application" ? { id, projectId: project.id, environment: "production" as const, name: `${project.slug}-${item.id}`, framework: item.id as Framework, repoUrl: "", branch: "main", installCommand: "pnpm install", buildCommand: "pnpm build", startCommand: "pnpm start", outputDirectory: null, port: 3000, status: "stopped" as const, createdAt: new Date().toISOString() } : undefined;
    const template = kind === "service" ? templates.find((entry) => entry.id === item.id) ?? { id: item.id, name: item.name, description: "Managed service", category: "database" as const, defaultVersion: item.version ?? "latest" } : undefined;
    const service = kind === "service" ? { id, projectId: project.id, environment: "production" as const, templateId: item.id, name: `${project.slug}-${item.id}`, version: item.version ?? "latest", status: "building" as const, createdAt: new Date().toISOString() } : undefined;
    setNodes((current) => [...current, { id, type: "resource", position: position ?? { x: 180 + (current.length % 3) * 280, y: 150 + Math.floor(current.length / 3) * 230 }, data: { kind, name: app?.name ?? service!.name, status: app?.status ?? service!.status, detail: app ? item.name : `${item.name} ${item.version ?? "latest"}`, brand: item.id, application: app, service, template } }]);
    toast.success(`${item.name} added to the canvas`);
  };

  return <>
    <style>{`.hefesto-project-canvas { --canvas-edge: rgba(163, 163, 163, 0.7); } .dark .hefesto-project-canvas { --canvas-edge: rgba(115, 115, 115, 0.7); }`}</style>
    <div className="hefesto-project-canvas relative h-[min(720px,calc(100vh-240px))] min-h-[560px] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <NodeActionContext.Provider value={actionContext}><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} onNodeDoubleClick={(_, node) => openConfig(node.id)} onPaneClick={() => { setSelectedNodeId(null); setConfigNodeId(null); setNodes((current) => current.map((node) => ({ ...node, selected: false }))); }} onInit={(instance) => { flowRef.current = instance; }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); const raw = event.dataTransfer.getData("application/hefesto-resource"); if (!raw || !flowRef.current) return; try { addResource(JSON.parse(raw) as PaletteItem, flowRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })); } catch { toast.error("Could not add this resource"); } }} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: .25 }} minZoom={.45} maxZoom={1.6} deleteKeyCode={["Backspace", "Delete"]}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="currentColor" className="text-neutral-300/20 dark:text-neutral-700/20" />
        <Controls showInteractive={false} className="!overflow-hidden !rounded-lg !border-neutral-200 !bg-white !shadow-sm dark:!border-neutral-800 dark:!bg-neutral-900 [&_button]:!border-neutral-200 [&_button]:!bg-white [&_button]:!text-neutral-700 dark:[&_button]:!border-neutral-800 dark:[&_button]:!bg-neutral-900 dark:[&_button]:!text-neutral-300" />
      </ReactFlow></NodeActionContext.Provider>
      <AddPalette open={addOpen} onOpenChange={setAddOpen} onAdd={addResource} />
      <Button className="absolute top-4 right-4 z-10 rounded-full shadow-sm" onClick={() => setAddOpen((value) => !value)}><Plus className="size-4" />Add <kbd className="rounded border border-white/20 px-1 text-[10px]">A</kbd></Button>
      {!nodes.length && <EmptyState icon={PackageOpen} title="Add your first service" description="Start with an application or managed database." action={<Button onClick={() => setAddOpen(true)}><Plus className="size-4" />Add resource</Button>} className="absolute top-1/2 left-1/2 z-10 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dashed bg-white/90 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/90" />}
    </div>
    {selectedNode && <NodeConfigDialog key={selectedNode.id} nodeData={selectedNode.data} activeTab={configTab} onTabChange={(tab) => openConfig(selectedNode.id, tab)} onClose={closeConfig} domains={domains} deployments={deployments} />}
  </>;
}
