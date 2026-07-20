"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background, BackgroundVariant, Controls, Handle, Position, ReactFlow,
  useEdgesState, useNodesState, type Connection, type Edge, type EdgeProps,
  type Node, type NodeMouseHandler, type NodeProps, type ReactFlowInstance,
} from "@xyflow/react";
import { AlertTriangle, ExternalLink, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { BrandIcon } from "@/components/brand-icon";
import { StatusBadge, StatusDot } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function ResourceNode({ data }: NodeProps<CanvasNode>) {
  const pulses = data.status === "running" || data.status === "building";
  return <div className={cn("w-[220px] rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-transform hover:-translate-y-px dark:border-neutral-800 dark:bg-neutral-900", glowByStatus[data.status])}>
    <Handle type="target" position={Position.Top} className="!size-2.5 !border-2 !border-white !bg-neutral-400 dark:!border-neutral-900" />
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-neutral-50 dark:bg-neutral-950"><BrandIcon name={data.brand} officialColor className="size-4" /></span>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{data.name}</p><StatusDot status={data.status} className={cn("size-2", pulses && "animate-pulse")} /></div><p className="mt-1 truncate text-xs text-muted-foreground">{data.detail}</p></div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3"><span className="truncate text-[11px] capitalize text-muted-foreground">{data.brand}</span><StatusBadge status={data.status} /></div>
    <Handle type="source" position={Position.Bottom} className="!size-2.5 !border-2 !border-white !bg-neutral-400 dark:!border-neutral-900" />
  </div>;
}

function KiteEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, style, data }: EdgeProps) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const sag = Math.min(80, dist * 0.25);
  const path = `M ${sourceX},${sourceY} C ${sourceX + dx * 0.25},${sourceY + sag} ${sourceX + dx * 0.75},${targetY + sag} ${targetX},${targetY}`;
  const active = Boolean(data?.active);
  return <path id={id} d={path} markerEnd={markerEnd} className="react-flow__edge-path" style={{ ...style, fill: "none", stroke: active ? "#f54900" : "rgba(163,163,163,.6)", strokeWidth: 1.5, strokeDasharray: active ? "7 6" : undefined }}>{active && <animate attributeName="stroke-dashoffset" from="26" to="0" dur=".8s" repeatCount="indefinite" />}</path>;
}

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
  return <div className="overflow-hidden rounded-xl border bg-neutral-950 text-neutral-200"><div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs text-neutral-400"><span className={cn("size-1.5 rounded-full", connected ? "animate-pulse bg-emerald-400" : "bg-neutral-600")} />{connected ? "Streaming live" : lines.length ? "Stream complete" : "Connecting…"}</div><ScrollArea className="h-[360px]"><div className="space-y-1 p-3 font-mono text-[11px] leading-5">{lines.map((line, index) => <div key={`${line.timestamp}-${index}`} className={line.stream === "stderr" ? "text-red-300" : line.stream === "system" ? "text-amber-300" : ""}><span className="mr-2 text-neutral-600">{new Date(line.timestamp).toLocaleTimeString()}</span>{line.message}</div>)}<div ref={endRef} /></div></ScrollArea></div>;
}

function NodeSheet({ node, open, onOpenChange, domains, deployments }: { node: CanvasNode | null; open: boolean; onOpenChange: (open: boolean) => void; domains: Domain[]; deployments: Deployment[] }) {
  const app = node?.data.application;
  const service = node?.data.service;
  const nodeDomains = app ? domains.filter((domain) => domain.applicationId === app.id) : [];
  const deployment = app ? deployments.find((item) => item.applicationId === app.id) : deployments[0];
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="w-[calc(100%-1rem)] sm:max-w-[420px]">
    <SheetHeader className="border-b pr-12"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg border"><BrandIcon name={node?.data.brand ?? "other"} officialColor /></span><div><SheetTitle>{node?.data.name}</SheetTitle><SheetDescription className="capitalize">{node?.data.kind} configuration</SheetDescription></div></div></SheetHeader>
    <Tabs defaultValue="overview" className="min-h-0 flex-1 gap-0"><TabsList variant="line" className="mx-4 max-w-full overflow-x-auto"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="variables">Variables</TabsTrigger><TabsTrigger value="domains">Domains</TabsTrigger><TabsTrigger value="logs">Logs</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger></TabsList>
      <ScrollArea className="min-h-0 flex-1"><div className="p-4">
        <TabsContent value="overview" className="space-y-5"><div className="flex items-center justify-between rounded-xl border p-4"><span className="text-muted-foreground">Status</span>{node && <StatusBadge status={node.data.status} />}</div><dl className="grid gap-4 rounded-xl border p-4 text-sm">{[[app ? "Framework" : "Service", node?.data.brand], [app ? "Domain" : "Version", app ? nodeDomains.find((domain) => domain.isPrimary)?.hostname ?? "Not configured" : service?.version], ["Install", app?.installCommand ?? "Managed image"], ["Build", app?.buildCommand ?? "Not required"], ["Start", app?.startCommand ?? "Managed by Hefesto"]].map(([label, value]) => <div key={label} className="grid grid-cols-[90px_1fr] gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="truncate font-mono text-xs">{value}</dd></div>)}</dl></TabsContent>
        <TabsContent value="variables" className="space-y-3">{["DATABASE_URL", "NODE_ENV", "SESSION_SECRET"].map((key) => <div key={key} className="rounded-xl border p-3"><Label className="text-xs">{key}</Label><p className="mt-1 font-mono text-xs text-muted-foreground">••••••••••••••••</p></div>)}</TabsContent>
        <TabsContent value="domains" className="space-y-3">{nodeDomains.length ? nodeDomains.map((domain) => <div key={domain.id} className="flex items-center gap-3 rounded-xl border p-3"><ExternalLink className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{domain.hostname}</p><p className="text-xs capitalize text-muted-foreground">SSL {domain.sslStatus}</p></div>{domain.isPrimary && <span className="text-xs text-muted-foreground">Primary</span>}</div>) : <p className="py-10 text-center text-sm text-muted-foreground">No domains configured for this resource.</p>}</TabsContent>
        <TabsContent value="logs"><LiveLogs deploymentId={deployment?.id} /></TabsContent>
        <TabsContent value="settings"><div className="rounded-xl border border-red-200 p-4 dark:border-red-900"><div className="flex gap-3"><AlertTriangle className="size-4 text-red-600" /><div><h3 className="font-medium text-red-700 dark:text-red-400">Danger zone</h3><p className="mt-1 text-xs text-muted-foreground">Permanently remove this resource and its configuration.</p><Button variant="destructive" size="sm" className="mt-4"><Trash2 className="size-3.5" />Delete resource</Button></div></div></div></TabsContent>
      </div></ScrollArea>
    </Tabs>
  </SheetContent></Sheet>;
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
  return <aside className={cn("absolute inset-y-3 left-3 z-20 flex w-[280px] flex-col overflow-hidden rounded-xl border bg-white/95 shadow-sm backdrop-blur-sm transition-all duration-150 dark:bg-neutral-900/95", open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[calc(100%+1rem)] opacity-0")}>
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
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const flowRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "a" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); setAddOpen((value) => !value); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const onNodeClick: NodeMouseHandler<CanvasNode> = (_, node) => setSelectedNode(node);
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
    <div className="relative h-[min(720px,calc(100vh-240px))] min-h-[560px] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} onInit={(instance) => { flowRef.current = instance; }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); const raw = event.dataTransfer.getData("application/hefesto-resource"); if (!raw || !flowRef.current) return; try { addResource(JSON.parse(raw) as PaletteItem, flowRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })); } catch { toast.error("Could not add this resource"); } }} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: .25 }} minZoom={.45} maxZoom={1.6} deleteKeyCode={["Backspace", "Delete"]}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="currentColor" className="text-neutral-300/20 dark:text-neutral-700/20" />
        <Controls showInteractive={false} className="!overflow-hidden !rounded-lg !border-neutral-200 !bg-white !shadow-sm dark:!border-neutral-800 dark:!bg-neutral-900 [&_button]:!border-neutral-200 [&_button]:!bg-white [&_button]:!text-neutral-700 dark:[&_button]:!border-neutral-800 dark:[&_button]:!bg-neutral-900 dark:[&_button]:!text-neutral-300" />
      </ReactFlow>
      <AddPalette open={addOpen} onOpenChange={setAddOpen} onAdd={addResource} />
      <Button className="absolute top-4 right-4 z-10 rounded-full shadow-sm" onClick={() => setAddOpen((value) => !value)}><Plus className="size-4" />Add <kbd className="rounded border border-white/20 px-1 text-[10px]">A</kbd></Button>
      {!nodes.length && <button type="button" onClick={() => setAddOpen(true)} className="absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-2xl border border-dashed bg-white/90 px-10 py-8 text-center shadow-sm transition-transform hover:-translate-y-[51%] dark:bg-neutral-900/90"><span className="flex size-10 items-center justify-center rounded-full bg-orange-50 text-orange-600 dark:bg-orange-950"><Plus className="size-5" /></span><span><span className="block font-semibold">Add your first service</span><span className="mt-1 block text-xs text-muted-foreground">Start with an application or managed database.</span></span></button>}
    </div>
    <NodeSheet node={selectedNode} open={Boolean(selectedNode)} onOpenChange={(open) => !open && setSelectedNode(null)} domains={domains} deployments={deployments} />
  </>;
}
